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
});
