import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { createPrismaClient } from '@sunshine/database';
import '../src/config/environment.js';

const [username, displayName, storeCode = 'STORE-001', storeName = 'sunshine1'] = process.argv.slice(2);
if (!username || !displayName) {
  throw new Error('Usage: pnpm bootstrap:admin <username> <displayName> [storeCode] [storeName]');
}

const prisma = createPrismaClient();
const temporaryPassword = `Sun-${randomBytes(9).toString('base64url')}!`;

try {
  const existing = await prisma.user.findFirst({ where: { username } });
  if (existing) {
    throw new Error(`User ${username} already exists; password was not changed`);
  }

  const passwordHash = await hash(temporaryPassword, 12);
  await prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.upsert({
      where: { code: 'SUNSHINE' },
      update: {},
      create: {
        code: 'SUNSHINE',
        name: 'Sunshine Store',
        expiryAlertSettings: { create: {} },
      },
    });
    const store = await transaction.store.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: storeCode,
        },
      },
      update: { name: storeName },
      create: {
        organizationId: organization.id,
        code: storeCode,
        name: storeName,
      },
    });
    const warehouse = await transaction.warehouse.upsert({
      where: {
        storeId_code: {
          storeId: store.id,
          code: 'MAIN',
        },
      },
      update: {},
      create: {
        storeId: store.id,
        code: 'MAIN',
        name: '主仓库',
      },
    });
    const role = await transaction.role.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: 'ADMIN',
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        code: 'ADMIN',
        name: '管理员',
      },
    });
    const user = await transaction.user.create({
      data: {
        organizationId: organization.id,
        username,
        displayName,
        passwordHash,
        mustChangePassword: true,
      },
    });
    await transaction.userStoreRole.create({
      data: { userId: user.id, storeId: store.id, roleId: role.id },
    });
    await transaction.userWarehousePermission.create({
      data: {
        userId: user.id,
        warehouseId: warehouse.id,
        canView: true,
        canReceive: true,
        canIssue: true,
        canTransfer: true,
        canCount: true,
      },
    });
  });

  process.stdout.write(
    JSON.stringify({ username, displayName, temporaryPassword }) + '\n',
  );
} finally {
  await prisma.$disconnect();
}
