import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LOGIN_RADIUS_OPTIONS, isValidPosition } from '../auth/store-location.js';
import { PrismaService } from '../database/prisma.service.js';

// CR-025: where a store is and which of its accounts may sign in only there. Administrators only.
@Injectable()
export class LoginSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async settings(organizationId: bigint, userId: bigint, storeId: bigint) {
    const store = await this.requireAdmin(organizationId, userId, storeId);
    const roles = await this.prisma.client.userStoreRole.findMany({
      where: { storeId, user: { organizationId, status: 'ACTIVE' } },
      select: { role: { select: { code: true, name: true } }, user: { select: { id: true, username: true, displayName: true, inStoreOnly: true } } },
      orderBy: { userId: 'asc' },
    });
    const users = new Map<bigint, { id: string; username: string; displayName: string; inStoreOnly: boolean; administrator: boolean; roles: string[] }>();
    for (const { role, user } of roles) {
      const entry = users.get(user.id) ?? { id: user.id.toString(), username: user.username, displayName: user.displayName, inStoreOnly: user.inStoreOnly, administrator: false, roles: [] };
      entry.roles.push(role.name);
      entry.administrator ||= role.code === 'ADMIN';
      users.set(user.id, entry);
    }
    return { store: this.storeResult(store), radiusOptions: LOGIN_RADIUS_OPTIONS, users: [...users.values()] };
  }

  async saveStore(organizationId: bigint, userId: bigint, storeId: bigint, input: { latitude: number | null; longitude: number | null; radius: number }) {
    const store = await this.requireAdmin(organizationId, userId, storeId);
    const cleared = input.latitude === null && input.longitude === null;
    if (!cleared && !isValidPosition({ latitude: input.latitude ?? undefined, longitude: input.longitude ?? undefined })) throw new BadRequestException('门店位置无效');
    if (!LOGIN_RADIUS_OPTIONS.includes(input.radius as never)) throw new BadRequestException('允许范围无效');
    // Six decimals is about 10 cm, the precision of the column.
    const round = (value: number | null) => (value === null ? null : Math.round(value * 1e6) / 1e6);
    const data = { latitude: round(input.latitude), longitude: round(input.longitude), loginRadiusM: input.radius };
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.store.update({ where: { id: storeId }, data, select: { id: true, name: true, latitude: true, longitude: true, loginRadiusM: true } });
      await tx.auditLog.create({ data: {
        organizationId, userId, storeId, action: 'store.login_location.update', entityType: 'Store', entityId: storeId.toString(), requestId: randomUUID(),
        beforeSummary: this.storeResult(store), afterSummary: this.storeResult(row),
      } });
      return row;
    });
    return this.storeResult(updated);
  }

  async setUserInStoreOnly(organizationId: bigint, userId: bigint, storeId: bigint, targetUserId: bigint, inStoreOnly: boolean) {
    await this.requireAdmin(organizationId, userId, storeId);
    const target = await this.prisma.client.user.findFirst({
      where: { id: targetUserId, organizationId, status: 'ACTIVE', storeRoles: { some: { storeId } } },
      select: { id: true, username: true, inStoreOnly: true, storeRoles: { select: { role: { select: { code: true } } } } },
    });
    if (!target) throw new NotFoundException('账号不存在');
    // An administrator limited to the shop could not reach this page from anywhere else to undo it.
    if (inStoreOnly && target.storeRoles.some(({ role }) => role.code === 'ADMIN')) throw new BadRequestException('管理员账号不能设置为仅限店内登录');
    if (target.inStoreOnly === inStoreOnly) return { id: target.id.toString(), inStoreOnly };
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id: target.id }, data: { inStoreOnly } }),
      this.prisma.client.auditLog.create({ data: {
        organizationId, userId, storeId, action: 'user.in_store_only.update', entityType: 'User', entityId: target.id.toString(), requestId: randomUUID(),
        beforeSummary: { username: target.username, inStoreOnly: target.inStoreOnly }, afterSummary: { username: target.username, inStoreOnly },
      } }),
    ]);
    return { id: target.id.toString(), inStoreOnly };
  }

  private async requireAdmin(organizationId: bigint, userId: bigint, storeId: bigint) {
    const store = await this.prisma.client.store.findFirst({
      where: { id: storeId, organizationId, status: 'ACTIVE' }, select: { id: true, name: true, latitude: true, longitude: true, loginRadiusM: true },
    });
    if (!store) throw new NotFoundException('门店不存在');
    const admin = await this.prisma.client.userStoreRole.findFirst({ where: { userId, storeId, role: { code: 'ADMIN' } }, select: { userId: true } });
    if (!admin) throw new ForbiddenException('只有管理员可以设置登录限制');
    return store;
  }

  private storeResult(store: { id: bigint; name: string; latitude: unknown; longitude: unknown; loginRadiusM: number }) {
    return {
      id: store.id.toString(), name: store.name,
      latitude: store.latitude === null ? null : Number(store.latitude), longitude: store.longitude === null ? null : Number(store.longitude),
      radius: store.loginRadiusM,
    };
  }
}
