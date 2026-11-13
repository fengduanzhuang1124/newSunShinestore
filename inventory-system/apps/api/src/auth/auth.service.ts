import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { LoginDto } from './login.dto.js';
import { distanceMetres, distanceText, isValidPosition, MAX_LOCATION_ACCURACY_M } from './store-location.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginDto) {
    const user = await this.prisma.client.user.findFirst({
      where: { username: input.username, status: 'ACTIVE' },
      include: {
        storeRoles: { include: { role: true, store: true } },
        warehousePermissions: { include: { warehouse: true } },
      },
    });

    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.inStoreOnly) await this.requireInStore(user, input);

    const accessToken = await this.jwt.signAsync({
      sub: user.id.toString(),
      organizationId: user.organizationId.toString(),
      username: user.username,
    });

    return {
      accessToken,
      user: {
        id: user.id.toString(),
        username: user.username,
        displayName: user.displayName,
        mustChangePassword: user.mustChangePassword,
        roles: user.storeRoles.map(({ role, store }) => ({
          code: role.code,
          storeId: store.id.toString(),
          storeName: store.name,
        })),
        warehouses: user.warehousePermissions.map(({ warehouse, canView, canReceive, canIssue, canCount }) => ({
          warehouseId: warehouse.id.toString(),
          warehouseName: warehouse.name,
          storeId: warehouse.storeId.toString(),
          canView,
          canReceive,
          canIssue,
          canCount,
        })),
      },
    };
  }

  // CR-025: checked only after the password, so the position is never asked for an unknown account.
  private async requireInStore(
    user: { id: bigint; organizationId: bigint; storeRoles: { store: { id: bigint; latitude: unknown; longitude: unknown; loginRadiusM: number } }[] },
    input: LoginDto,
  ) {
    const position = { latitude: input.latitude, longitude: input.longitude };
    if (!isValidPosition(position)) {
      throw new HttpException('该账号只能在门店内登录，请允许获取位置后重试', HttpStatus.PRECONDITION_REQUIRED);
    }
    if (input.accuracy !== undefined && input.accuracy > MAX_LOCATION_ACCURACY_M) {
      throw new ForbiddenException('定位不够准确，请打开手机的精确定位后重试');
    }
    const stores = user.storeRoles.map(({ store }) => store)
      .filter((store) => store.latitude !== null && store.longitude !== null)
      .map((store) => ({ id: store.id, radius: store.loginRadiusM, distance: distanceMetres(position, { latitude: Number(store.latitude), longitude: Number(store.longitude) }) }));
    if (!stores.length) throw new ForbiddenException('门店还没有设置位置，暂时不能登录，请联系管理员');
    const nearest = stores.reduce((best, store) => (store.distance < best.distance ? store : best));
    if (nearest.distance <= nearest.radius) return;
    await this.prisma.client.auditLog.create({ data: {
      organizationId: user.organizationId, userId: user.id, storeId: nearest.id, action: 'auth.login.outside_store', entityType: 'User',
      entityId: user.id.toString(), requestId: randomUUID(),
      afterSummary: { distanceMetres: Math.round(nearest.distance), radiusMetres: nearest.radius, accuracyMetres: input.accuracy ?? null },
    } });
    throw new ForbiddenException(`该账号只能在门店内登录（当前距离门店约 ${distanceText(nearest.distance)}）`);
  }

  async changePassword(organizationId: bigint, userId: bigint, currentPassword: string, newPassword: string) {
    const user = await this.prisma.client.user.findFirst({ where: { id: userId, organizationId, status: 'ACTIVE' }, select: { id: true, passwordHash: true } });
    if (!user || !(await compare(currentPassword, user.passwordHash))) throw new UnauthorizedException('当前密码不正确');
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id: user.id }, data: { passwordHash: await hash(newPassword, 12), mustChangePassword: false } }),
      this.prisma.client.auditLog.create({ data: { organizationId, userId, action: 'auth.password.change', entityType: 'User', entityId: user.id.toString(), requestId: randomUUID(), afterSummary: { passwordChanged: true } } }),
    ]);
    return { passwordChanged: true };
  }
}
