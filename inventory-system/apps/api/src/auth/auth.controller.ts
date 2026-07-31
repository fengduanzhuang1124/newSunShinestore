import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
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
}
