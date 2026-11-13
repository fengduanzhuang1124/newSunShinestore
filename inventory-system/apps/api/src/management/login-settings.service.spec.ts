import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LoginSettingsService } from './login-settings.service.js';

function setup(options: { admin?: boolean; target?: Record<string, unknown> | null } = {}) {
  const store = { id: 1n, name: '第一门店', latitude: null, longitude: null, loginRadiusM: 300 };
  const client = {
    store: {
      findFirst: jest.fn().mockResolvedValue(store as never),
      update: jest.fn().mockImplementation((async ({ data }: { data: Record<string, unknown> }) => ({ ...store, ...data })) as never),
    },
    userStoreRole: {
      findFirst: jest.fn().mockResolvedValue((options.admin === false ? null : { userId: 9n }) as never),
      findMany: jest.fn().mockResolvedValue([
        { role: { code: 'ADMIN', name: '管理员' }, user: { id: 9n, username: 'wf1124', displayName: '管理员', inStoreOnly: false } },
        { role: { code: 'STAFF', name: '店员' }, user: { id: 1n, username: 'wf66', displayName: '员工1', inStoreOnly: true } },
      ] as never),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue((options.target === undefined ? { id: 1n, username: 'wf66', inStoreOnly: false, storeRoles: [{ role: { code: 'STAFF' } }] } : options.target) as never),
      update: jest.fn().mockResolvedValue({} as never),
    },
    auditLog: { create: jest.fn().mockResolvedValue({} as never) },
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation((async (work: unknown) => (typeof work === 'function' ? work(client) : Promise.all(work as Promise<unknown>[]))) as never);
  return { client, service: new LoginSettingsService({ client } as never) };
}

describe('LoginSettingsService (CR-025)', () => {
  it('lists each account once with its roles and whether it is limited to the store', async () => {
    const { service } = setup();
    await expect(service.settings(2n, 9n, 1n)).resolves.toEqual({
      store: { id: '1', name: '第一门店', latitude: null, longitude: null, radius: 300 },
      radiusOptions: [100, 200, 300, 500, 1000],
      users: [
        { id: '9', username: 'wf1124', displayName: '管理员', inStoreOnly: false, administrator: true, roles: ['管理员'] },
        { id: '1', username: 'wf66', displayName: '员工1', inStoreOnly: true, administrator: false, roles: ['店员'] },
      ],
    });
  });

  it('saves the store position and radius with an audit record', async () => {
    const { service, client } = setup();
    await expect(service.saveStore(2n, 9n, 1n, { latitude: -37.78712345, longitude: 175.2791, radius: 200 })).resolves.toEqual({ id: '1', name: '第一门店', latitude: -37.787123, longitude: 175.2791, radius: 200 });
    expect(client.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'store.login_location.update', afterSummary: expect.objectContaining({ radius: 200 }) }) });
    await expect(service.saveStore(2n, 9n, 1n, { latitude: -37.7, longitude: 175.2, radius: 250 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.saveStore(2n, 9n, 1n, { latitude: 95, longitude: 175.2, radius: 300 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('limits a staff account but never an administrator', async () => {
    const staff = setup();
    await expect(staff.service.setUserInStoreOnly(2n, 9n, 1n, 1n, true)).resolves.toEqual({ id: '1', inStoreOnly: true });
    expect(staff.client.user.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { inStoreOnly: true } });
    expect(staff.client.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'user.in_store_only.update', afterSummary: { username: 'wf66', inStoreOnly: true } }) });
    const admin = setup({ target: { id: 9n, username: 'wf1124', inStoreOnly: false, storeRoles: [{ role: { code: 'ADMIN' } }] } });
    await expect(admin.service.setUserInStoreOnly(2n, 9n, 1n, 9n, true)).rejects.toThrow('管理员账号不能设置为仅限店内登录');
  });

  it('is for administrators only', async () => {
    const { service } = setup({ admin: false });
    await expect(service.settings(2n, 1n, 1n)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setUserInStoreOnly(2n, 1n, 1n, 1n, false)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
