import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  inventoryUser?: {
    id: bigint;
    organizationId: bigint;
    username: string;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('请先登录');
    }

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        organizationId: string;
        username: string;
      }>(token);
      request.inventoryUser = {
        id: BigInt(payload.sub),
        organizationId: BigInt(payload.organizationId),
        username: payload.username,
      };
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期');
    }
  }
}
