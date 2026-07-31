import { hash } from 'bcryptjs';
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
});
