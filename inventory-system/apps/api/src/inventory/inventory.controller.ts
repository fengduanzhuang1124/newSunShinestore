import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { InventoryService } from './inventory.service.js';
import { ScanReceiveDto } from './scan-receive.dto.js';
import { ManualIssueDto } from './manual-issue.dto.js';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('search')
  async search(
    @Req() request: AuthenticatedRequest,
    @Query('q') query: string,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '查询成功',
      data: await this.inventory.search(
        user.organizationId,
        user.id,
        query ?? '',
      ),
    };
  }

  @Get('barcode/:barcode')
  async findByBarcode(
    @Req() request: AuthenticatedRequest,
    @Param('barcode') barcode: string,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '查询成功',
      data: await this.inventory.findByBarcode(
        user.organizationId,
        user.id,
        barcode,
      ),
    };
  }

  @Post('scan-receive')
  async receive(
    @Req() request: AuthenticatedRequest,
    @Body() input: ScanReceiveDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '入库成功',
      data: await this.inventory.receive(user.organizationId, user.id, input),
    };
  }
  @Post('manual-issue')
  async issue(
    @Req() request: AuthenticatedRequest,
    @Body() input: ManualIssueDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '出库成功',
      data: await this.inventory.issueToShelf(
        user.organizationId,
        user.id,
        input,
      ),
    };
  }
}
