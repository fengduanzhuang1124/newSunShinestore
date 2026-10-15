import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { AssignWarehouseLocationDto, SaveWarehouseLocationDto } from './warehouse-location.dto.js';

@Injectable()
export class WarehouseLocationService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService) {}

  async list(organizationId: bigint, userId: bigint) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const [locations, balances] = await Promise.all([
      this.prisma.client.warehouseLocation.findMany({
        where: { warehouseId: permission.warehouseId, status: 'ACTIVE' },
        orderBy: [{ zone: 'asc' }, { code: 'asc' }],
        include: { placements: { where: { quantity: { gt: 0 } }, include: { product: true, batch: true } } },
      }),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, warehouseId: permission.warehouseId, quantity: { gt: 0 } },
        select: { productId: true, batchId: true, quantity: true },
      }),
    ]);
    const assigned = new Map<string, number>();
    for (const location of locations) for (const item of location.placements) {
      const key = `${item.productId}:${item.batchId}`;
      assigned.set(key, (assigned.get(key) ?? 0) + item.quantity);
    }
    return {
      warehouseId: permission.warehouseId.toString(),
      warehouseName: permission.warehouse.name,
      canManage: true,
      unassignedTotal: balances.reduce((sum, balance) => sum + Math.max(0, balance.quantity - (assigned.get(`${balance.productId}:${balance.batchId}`) ?? 0)), 0),
      locations: locations.map((location) => ({
        locationId: location.id.toString(), code: location.code, name: location.name,
        zone: location.zone, aisle: location.aisle, shelf: location.shelf, level: location.level,
        totalQuantity: location.placements.reduce((sum, item) => sum + item.quantity, 0),
        productCount: new Set(location.placements.map((item) => item.productId.toString())).size,
        placements: location.placements.map((item) => ({
          productId: item.productId.toString(), batchId: item.batchId.toString(), quantity: item.quantity,
          productName: item.product.name,
          expiryDate: item.batch.expiryPrecision === 'MONTH' ? item.batch.expiryDate.toISOString().slice(0, 7) : item.batch.expiryDate.toISOString().slice(0, 10),
        })),
      })),
    };
  }

  async create(organizationId: bigint, userId: bigint, input: SaveWarehouseLocationDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const location = await this.prisma.client.warehouseLocation.create({ data: {
      warehouseId: permission.warehouseId, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      zone: input.zone?.trim() || null, aisle: input.aisle?.trim() || null, shelf: input.shelf?.trim() || null, level: input.level?.trim() || null,
      createdById: userId, updatedById: userId,
    }});
    await this.audit(organizationId, userId, permission.warehouse.storeId, permission.warehouseId, 'CREATE_WAREHOUSE_LOCATION', location.id.toString(), null, input);
    return { locationId: location.id.toString() };
  }

  async update(organizationId: bigint, userId: bigint, locationId: string, input: SaveWarehouseLocationDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const id = BigInt(locationId);
    const before = await this.prisma.client.warehouseLocation.findFirst({ where: { id, warehouseId: permission.warehouseId } });
    if (!before) throw new NotFoundException('没有找到这个仓位');
    await this.prisma.client.warehouseLocation.update({ where: { id }, data: {
      code: input.code.trim().toUpperCase(), name: input.name.trim(), zone: input.zone?.trim() || null,
      aisle: input.aisle?.trim() || null, shelf: input.shelf?.trim() || null, level: input.level?.trim() || null, updatedById: userId,
    }});
    await this.audit(organizationId, userId, permission.warehouse.storeId, permission.warehouseId, 'UPDATE_WAREHOUSE_LOCATION', locationId, before, input);
    return { locationId };
  }

  async assign(organizationId: bigint, userId: bigint, input: AssignWarehouseLocationDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const productId = BigInt(input.productId); const batchId = BigInt(input.batchId); const locationId = BigInt(input.locationId);
    const [location, balance, placements] = await Promise.all([
      this.prisma.client.warehouseLocation.findFirst({ where: { id: locationId, warehouseId: permission.warehouseId, status: 'ACTIVE' } }),
      this.prisma.client.inventoryBalance.findUnique({ where: { organizationId_warehouseId_productId_batchId: { organizationId, warehouseId: permission.warehouseId, productId, batchId } } }),
      this.prisma.client.inventoryPlacement.findMany({ where: { organizationId, warehouseId: permission.warehouseId, productId, batchId } }),
    ]);
    if (!location) throw new NotFoundException('没有找到这个仓位');
    if (!balance) throw new NotFoundException('没有找到对应库存批次');
    const otherQuantity = placements.filter((item) => item.locationId !== locationId).reduce((sum, item) => sum + item.quantity, 0);
    if (otherQuantity + input.quantity > balance.quantity) throw new BadRequestException(`仓位分配不能超过批次库存 ${balance.quantity} 件`);
    await this.prisma.client.inventoryPlacement.upsert({
      where: { organizationId_warehouseId_locationId_productId_batchId: { organizationId, warehouseId: permission.warehouseId, locationId, productId, batchId } },
      create: { organizationId, warehouseId: permission.warehouseId, locationId, productId, batchId, quantity: input.quantity },
      update: { quantity: input.quantity },
    });
    await this.audit(organizationId, userId, permission.warehouse.storeId, permission.warehouseId, 'ASSIGN_WAREHOUSE_LOCATION', `${locationId}:${productId}:${batchId}`, placements, input);
    return { locationId: input.locationId, quantity: input.quantity };
  }

  private async audit(organizationId: bigint, userId: bigint, storeId: bigint, warehouseId: bigint, action: string, entityId: string, beforeSummary: unknown, afterSummary: unknown) {
    const jsonSummary = (value: unknown) => value == null ? undefined : JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
    await this.prisma.client.auditLog.create({ data: {
      organizationId, userId, storeId, warehouseId, action, entityType: 'WarehouseLocation', entityId,
      requestId: randomUUID(), beforeSummary: jsonSummary(beforeSummary), afterSummary: jsonSummary(afterSummary),
    }});
  }
}
