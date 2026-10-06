import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';
import { LoginDto } from './login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() input: LoginDto) {
    return {
      code: 200,
      message: '登录成功',
      data: await this.auth.login(input),
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() input: { currentPassword?: string; newPassword?: string },
  ) {
    if (!input.currentPassword || input.currentPassword.length > 128) throw new BadRequestException('请输入当前密码');
    if (!input.newPassword || input.newPassword.length < 8 || input.newPassword.length > 128) throw new BadRequestException('新密码长度应为8至128位');
    if (input.currentPassword === input.newPassword) throw new BadRequestException('新密码不能与当前密码相同');
    const user = request.inventoryUser!;
    return { code: 200, message: '密码修改成功', data: await this.auth.changePassword(user.organizationId, user.id, input.currentPassword, input.newPassword) };
  }
}
