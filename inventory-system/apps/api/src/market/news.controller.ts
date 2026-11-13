import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { CreateNewsSourceDto, NEWS_REGIONS, UpdateNewsSourceDto, type NewsRegionCode } from './news.dto.js';
import { NEWS_TOPICS } from './news-feed.js';
import { NewsService } from './news.service.js';

// Industry news for market analysis (REQ-016 part 3). Fixed paths are declared before /:id.
@Controller('news')
@UseGuards(JwtAuthGuard)
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest, @Query('storeId') storeId?: string, @Query('days') days = '30',
    @Query('region') region?: string, @Query('topic') topic?: string, @Query('sourceId') sourceId?: string,
  ) {
    if (!['7', '30', '90'].includes(days)) throw new BadRequestException('时间范围只能是 7、30 或 90 天');
    if (region && !NEWS_REGIONS.includes(region as NewsRegionCode)) throw new BadRequestException('地区参数无效');
    if (topic && !NEWS_TOPICS.some((item) => item.key === topic)) throw new BadRequestException('主题参数无效');
    const user = request.inventoryUser!;
    const data = await this.news.list(user.organizationId, user.id, this.id(storeId, '门店'), {
      days: Number(days), region: region as NewsRegionCode | undefined, topic, sourceId: sourceId ? this.id(sourceId, '来源') : undefined,
    });
    return { code: 200, message: '行业新闻查询成功', data };
  }

  @Get('sources')
  async sources(@Req() request: AuthenticatedRequest, @Query('storeId') storeId?: string) {
    const user = request.inventoryUser!;
    return { code: 200, message: '新闻来源查询成功', data: await this.news.sources(user.organizationId, user.id, this.id(storeId, '门店')) };
  }

  @Post('sources')
  async createSource(@Req() request: AuthenticatedRequest, @Query('storeId') storeId: string | undefined, @Body() body: CreateNewsSourceDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '新闻来源已添加', data: await this.news.createSource(user.organizationId, user.id, this.id(storeId, '门店'), body) };
  }

  @Post('refresh')
  async refresh(@Req() request: AuthenticatedRequest, @Query('storeId') storeId?: string) {
    const user = request.inventoryUser!;
    return { code: 200, message: '行业新闻已更新', data: await this.news.refreshNow(user.organizationId, user.id, this.id(storeId, '门店')) };
  }

  @Patch('sources/:id')
  async updateSource(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Query('storeId') storeId: string | undefined, @Body() body: UpdateNewsSourceDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '新闻来源已保存', data: await this.news.updateSource(user.organizationId, user.id, this.id(storeId, '门店'), this.id(id, '来源'), body) };
  }

  private id(value: string | undefined, label: string) {
    if (!value || !/^\d{1,19}$/.test(value)) throw new BadRequestException(`${label}参数无效`);
    return BigInt(value);
  }
}
