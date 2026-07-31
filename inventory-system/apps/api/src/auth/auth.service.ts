import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
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
      },
    };
  }
}
