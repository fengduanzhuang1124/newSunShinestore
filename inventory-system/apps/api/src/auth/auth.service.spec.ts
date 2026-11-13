import { hash } from 'bcryptjs';
import { jest } from '@jest/globals';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  it('returns a token and safe user profile for valid credentials', async () => {
    const passwordHash = await hash('Valid-test-password!', 4);
    const prisma = {
      client: {
        user: {
          findFirst: async () => ({
            id: 1n,
            organizationId: 2n,
            username: 'wf66',
            displayName: '员工1',
            passwordHash,
            mustChangePassword: true,
            storeRoles: [
              {
                role: { code: 'ADMIN' },
                store: { id: 3n, name: '第一门店' },
              },
            ],
            warehousePermissions: [],
          }),
        },
      },
    };
    const jwt = { signAsync: async () => 'signed-token' };
    const service = new AuthService(prisma as never, jwt as never);

    await expect(
      service.login({ username: 'wf66', password: 'Valid-test-password!' }),
    ).resolves.toEqual({
      accessToken: 'signed-token',
      user: {
        id: '1',
        username: 'wf66',
        displayName: '员工1',
        mustChangePassword: true,
        roles: [
          { code: 'ADMIN', storeId: '3', storeName: '第一门店' },
        ],
        warehouses: [],
      },
    });
  });

  it('rejects an incorrect password without revealing which field failed', async () => {
    const passwordHash = await hash('Valid-test-password!', 4);
    const prisma = {
      client: {
        user: {
          findFirst: async () => ({
            passwordHash,
            storeRoles: [],
            warehousePermissions: [],
          }),
        },
      },
    };
    const service = new AuthService(prisma as never, {} as never);

    await expect(
      service.login({ username: 'wf66', password: 'Wrong-password!' }),
    ).rejects.toThrow('用户名或密码错误');
  });

  it('changes an authenticated user password and clears the temporary password flag', async () => {
    const passwordHash = await hash('Old-password!', 4);
    const update = jest.fn().mockResolvedValue({ id: 1n } as never);
    const auditCreate = jest.fn().mockResolvedValue({ id: 2n } as never);
    const prisma = { client: { user: { findFirst: jest.fn().mockResolvedValue({ id: 1n, passwordHash } as never), update }, auditLog: { create: auditCreate }, $transaction: jest.fn().mockResolvedValue([] as never) } };
    const service = new AuthService(prisma as never, {} as never);
    await expect(service.changePassword(2n, 1n, 'Old-password!', 'New-password!')).resolves.toEqual({ passwordChanged: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1n }, data: expect.objectContaining({ mustChangePassword: false }) }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'auth.password.change', userId: 1n }) }));
  });

  it('rejects password changes when the current password is incorrect', async () => {
    const passwordHash = await hash('Old-password!', 4);
    const prisma = { client: { user: { findFirst: jest.fn().mockResolvedValue({ id: 1n, passwordHash } as never) } } };
    const service = new AuthService(prisma as never, {} as never);
    await expect(service.changePassword(2n, 1n, 'Wrong-password!', 'New-password!')).rejects.toThrow('当前密码不正确');
  });

  describe('in-store accounts (CR-025)', () => {
    // A shop in Hamilton; 0.001° of latitude is about 111 m.
    const shop = { id: 3n, name: '第一门店', latitude: '-37.787000', longitude: '175.279000', loginRadiusM: 300 };
    async function setup(store: Record<string, unknown> = shop) {
      const passwordHash = await hash('Valid-test-password!', 4);
      const auditCreate = jest.fn().mockResolvedValue({} as never);
      const prisma = { client: {
        user: { findFirst: async () => ({ id: 1n, organizationId: 2n, username: 'wf66', displayName: '员工1', passwordHash, mustChangePassword: false, inStoreOnly: true, storeRoles: [{ role: { code: 'STAFF' }, store }], warehousePermissions: [] }) },
        auditLog: { create: auditCreate },
      } };
      return { service: new AuthService(prisma as never, { signAsync: async () => 'signed-token' } as never), auditCreate };
    }
    const login = { username: 'wf66', password: 'Valid-test-password!' };

    it('asks for the position, then lets the account in only within the store radius', async () => {
      const { service, auditCreate } = await setup();
      await expect(service.login(login)).rejects.toMatchObject({ status: 428 });
      await expect(service.login({ ...login, latitude: -37.7885, longitude: 175.279, accuracy: 30 })).resolves.toMatchObject({ accessToken: 'signed-token' });
      await expect(service.login({ ...login, latitude: -37.8, longitude: 175.279, accuracy: 30 })).rejects.toThrow('该账号只能在门店内登录（当前距离门店约 1.4 公里）');
      expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'auth.login.outside_store', storeId: 3n, afterSummary: { distanceMetres: 1446, radiusMetres: 300, accuracyMetres: 30 } }) });
    });

    it('refuses a vague reading and a store without a position', async () => {
      const { service } = await setup();
      await expect(service.login({ ...login, latitude: -37.787, longitude: 175.279, accuracy: 5000 })).rejects.toThrow('定位不够准确');
      const unset = await setup({ ...shop, latitude: null, longitude: null });
      await expect(unset.service.login({ ...login, latitude: -37.787, longitude: 175.279 })).rejects.toThrow('门店还没有设置位置');
    });
  });
});
