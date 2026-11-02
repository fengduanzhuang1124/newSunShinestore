import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import {
  AskAssistantDto, AssistantAliasDto, AssistantAnswerDto, AssistantFeedbackDto, UpdateAssistantAliasDto, UpdateAssistantAnswerDto, UpdateMailMilkDto,
} from './assistant.dto.js';
import { AssistantService } from './assistant.service.js';

// 阳光小助手 (REQ-015 stage 2). Asking is open to every store member; settings are for administrators.
@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('replies')
  async reply(@Req() request: AuthenticatedRequest, @Query('storeId') storeId: string | undefined, @Body() body: AskAssistantDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '建议回复已生成', data: await this.assistant.reply(user.organizationId, user.id, this.id(storeId, '门店'), body.question.trim()) };
  }

  @Post('replies/:id/feedback')
  async feedback(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Query('storeId') storeId: string | undefined, @Body() body: AssistantFeedbackDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '已记录处理结果', data: await this.assistant.feedback(user.organizationId, user.id, this.id(storeId, '门店'), this.id(id, '回复'), body) };
  }

  @Get('mail-milk')
  async mailMilk(@Req() request: AuthenticatedRequest, @Query('storeId') storeId?: string) {
    const user = request.inventoryUser!;
    return { code: 200, message: '邮寄奶粉设置查询成功', data: await this.assistant.mailMilk(user.organizationId, user.id, this.id(storeId, '门店')) };
  }

  @Post('mail-milk/detect')
  async detectMailMilk(@Req() request: AuthenticatedRequest, @Query('storeId') storeId?: string) {
    const user = request.inventoryUser!;
    return { code: 200, message: '已识别邮寄奶粉', data: await this.assistant.detectMailMilk(user.organizationId, user.id, this.id(storeId, '门店')) };
  }

  @Patch('mail-milk/:productId')
  async updateMailMilk(@Req() request: AuthenticatedRequest, @Param('productId') productId: string, @Query('storeId') storeId: string | undefined, @Body() body: UpdateMailMilkDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '邮寄奶粉设置已保存', data: await this.assistant.updateMailMilk(user.organizationId, user.id, this.id(storeId, '门店'), this.id(productId, '商品'), body) };
  }

  @Get('aliases')
  async aliases(@Req() request: AuthenticatedRequest, @Query('storeId') storeId?: string) {
    const user = request.inventoryUser!;
    return { code: 200, message: '叫法查询成功', data: await this.assistant.aliases(user.organizationId, user.id, this.id(storeId, '门店')) };
  }

  @Post('aliases')
  async createAlias(@Req() request: AuthenticatedRequest, @Query('storeId') storeId: string | undefined, @Body() body: AssistantAliasDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '叫法已添加', data: await this.assistant.saveAlias(user.organizationId, user.id, this.id(storeId, '门店'), null, body) };
  }

  @Patch('aliases/:id')
  async updateAlias(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Query('storeId') storeId: string | undefined, @Body() body: UpdateAssistantAliasDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '叫法已保存', data: await this.assistant.saveAlias(user.organizationId, user.id, this.id(storeId, '门店'), this.id(id, '叫法'), body) };
  }

  @Get('answers')
  async answers(@Req() request: AuthenticatedRequest, @Query('storeId') storeId?: string) {
    const user = request.inventoryUser!;
    return { code: 200, message: '固定回复查询成功', data: await this.assistant.answers(user.organizationId, user.id, this.id(storeId, '门店')) };
  }

  @Post('answers')
  async createAnswer(@Req() request: AuthenticatedRequest, @Query('storeId') storeId: string | undefined, @Body() body: AssistantAnswerDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '固定回复已添加', data: await this.assistant.saveAnswer(user.organizationId, user.id, this.id(storeId, '门店'), null, body) };
  }

  @Patch('answers/:id')
  async updateAnswer(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Query('storeId') storeId: string | undefined, @Body() body: UpdateAssistantAnswerDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '固定回复已保存', data: await this.assistant.saveAnswer(user.organizationId, user.id, this.id(storeId, '门店'), this.id(id, '固定回复'), body) };
  }

  private id(value: string | undefined, label: string) {
    if (!value || !/^\d{1,19}$/.test(value)) throw new BadRequestException(`${label}参数无效`);
    return BigInt(value);
  }
}
