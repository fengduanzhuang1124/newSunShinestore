import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { LoginDto } from './login.dto.js';

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
