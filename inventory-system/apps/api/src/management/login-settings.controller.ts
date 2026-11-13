import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { LoginSettingsService } from './login-settings.service.js';

// CR-025: the store's position and which accounts may sign in only there.
@Controller('management/login-settings')
@UseGuards(JwtAuthGuard)
export class LoginSettingsController {
  constructor(private readonly loginSettings: LoginSettingsService) {}

  @Get()
  async settings(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue?: string) {
    const user = request.inventoryUser!;
    return { code: 200, message: '登录限制查询成功', data: await this.loginSettings.settings(user.organizationId, user.id, this.storeId(storeIdValue)) };
  }

  @Post('store')
  async saveStore(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue: string | undefined, @Body() input: { latitude?: unknown; longitude?: unknown; radius?: unknown }) {
    const storeId = this.storeId(storeIdValue);
    const coordinate = (value: unknown) => (value === null || value === undefined || value === '' ? null : typeof value === 'number' && Number.isFinite(value) ? value : NaN);
    const latitude = coordinate(input.latitude);
    const longitude = coordinate(input.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude) || (latitude === null) !== (longitude === null)) throw new BadRequestException('请同时填写有效的纬度和经度');
    if (typeof input.radius !== 'number' || !Number.isInteger(input.radius)) throw new BadRequestException('允许范围无效');
    const user = request.inventoryUser!;
    return { code: 200, message: latitude === null ? '门店位置已清除' : '门店位置已保存', data: await this.loginSettings.saveStore(user.organizationId, user.id, storeId, { latitude, longitude, radius: input.radius }) };
  }

  @Post('user')
  async setUser(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue: string | undefined, @Body() input: { userId?: unknown; inStoreOnly?: unknown }) {
    const storeId = this.storeId(storeIdValue);
    if (typeof input.userId !== 'string' || !/^\d+$/.test(input.userId)) throw new BadRequestException('账号参数无效');
    if (typeof input.inStoreOnly !== 'boolean') throw new BadRequestException('限制参数无效');
    const user = request.inventoryUser!;
    return { code: 200, message: input.inStoreOnly ? '已设置为仅限店内登录' : '已取消店内登录限制', data: await this.loginSettings.setUserInStoreOnly(user.organizationId, user.id, storeId, BigInt(input.userId), input.inStoreOnly) };
  }

  private storeId(value?: string) {
    if (!value || !/^\d+$/.test(value)) throw new BadRequestException('门店参数无效');
    return BigInt(value);
  }
}
