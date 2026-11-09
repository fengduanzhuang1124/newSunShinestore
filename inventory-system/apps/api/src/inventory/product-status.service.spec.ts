import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { ProductStatusService } from './product-status.service.js';

const permission = { warehouseId: 2n, warehouse: { storeId: 3n, name: '主仓库' } };

function setup(options: { balances?: { quantity: number }[]; admin?: boolean } = {}) {
  const tx = {
    product: { update: jest.fn().mockResolvedValue({} as never) },
    auditLog: { create: jest.fn().mockResolvedValue({} as never) },
  };
  const client = {
    product: {
      findFirst: jest.fn().mockResolvedValue({ id: 7n, name: 'Swisse 旧款护肝片' } as never),
      findMany: jest.fn().mockResolvedValue([{ id: 7n, name: 'Swisse 旧款护肝片', barcodes: [{ barcode: '9311770000007' }] }] as never),
    },
    inventoryBalance: { findMany: jest.fn().mockResolvedValue((options.balances ?? []) as never) },
    auditLog: { findMany: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn().mockImplementation(((callback: (client: typeof tx) => unknown) => callback(tx)) as never),
  };
  const permissions = {
    warehousePermission: jest.fn().mockResolvedValue(permission as never),
    requireStoreAdmin: options.admin === false ? jest.fn().mockRejectedValue(new ForbiddenException('需要管理员权限') as never) : jest.fn().mockResolvedValue(undefined as never),
  };
  return { service: new ProductStatusService({ client } as never, permissions as never), client, tx };
}

describe('ProductStatusService (CR-020)', () => {
  it('discontinues a product with no stock and records why', async () => {
    const { service, tx } = setup();
    await expect(service.discontinue(1n, 9n, '7', '厂家停产')).resolves.toEqual({ productId: '7', productName: 'Swisse 旧款护肝片' });
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { status: 'INACTIVE' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'product.discontinue', entityId: '7', afterSummary: { status: 'INACTIVE', reason: '厂家停产' } }) });
  });

  it('refuses to discontinue while any stock record is not zero, including negative stock', async () => {
    const { service, tx } = setup({ balances: [{ quantity: 3 }, { quantity: -1 }] });
    await expect(service.discontinue(1n, 9n, '7', '不卖了')).rejects.toThrow('合计 2 件');
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('lets only admins change product status', async () => {
    const { service } = setup({ admin: false });
    await expect(service.discontinue(1n, 9n, '7', '不卖了')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.rename(1n, 9n, '7', '新名字')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists products whose latest status change is a discontinue, not restored or merged ones', async () => {
    const { service, client } = setup();
    client.auditLog.findMany.mockResolvedValue([
      { action: 'product.discontinue', entityId: '7', createdAt: new Date('2026-11-09T01:00:00Z'), afterSummary: { reason: '厂家停产' }, user: { displayName: '管理员' } },
      { action: 'product.restore', entityId: '8', createdAt: new Date('2026-11-08T01:00:00Z'), afterSummary: {}, user: { displayName: '管理员' } },
      { action: 'product.discontinue', entityId: '8', createdAt: new Date('2026-11-07T01:00:00Z'), afterSummary: {}, user: { displayName: '管理员' } },
    ] as never);
    const rows = await service.listDiscontinued(1n, 9n);
    expect(client.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'INACTIVE', id: { in: [7n] } }) }));
    expect(rows).toEqual([{ productId: '7', productName: 'Swisse 旧款护肝片', barcodes: ['9311770000007'], discontinuedAt: '2026-11-09T01:00:00.000Z', reason: '厂家停产', performedBy: '管理员' }]);
  });

  it('restores only a discontinued product', async () => {
    const { service, client, tx } = setup();
    client.auditLog.findFirst.mockResolvedValueOnce({ action: 'product.discontinue' } as never);
    await service.restore(1n, 9n, '7');
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { status: 'ACTIVE' } });
    client.auditLog.findFirst.mockResolvedValueOnce(null as never);
    await expect(service.restore(1n, 9n, '7')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renames the name pages show, with an audit of the old and new name, and rejects a blank name', async () => {
    const { service, tx } = setup();
    await service.rename(1n, 9n, '7', '  Swisse 护肝片 120粒 ');
    // The Chinese name is what pages show first, so it takes the new name too.
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { name: 'Swisse 护肝片 120粒', chineseName: 'Swisse 护肝片 120粒' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'product.rename', beforeSummary: { name: 'Swisse 旧款护肝片' }, afterSummary: { name: 'Swisse 护肝片 120粒', chineseName: 'Swisse 护肝片 120粒' } }) });
    await expect(service.rename(1n, 9n, '7', '   ')).rejects.toBeInstanceOf(BadRequestException);
  });
});
