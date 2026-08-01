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
import { StocktakeAdjustmentDto } from './stocktake-adjustment.dto.js';

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

  @Get('receipts')
  async receipts(
    @Req() request: AuthenticatedRequest,
    @Query('date') date?: string,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '入库记录查询成功',
      data: await this.inventory.listReceipts(user.organizationId, user.id, date),
    };
  }

  @Post('receipts/current/complete')
  async completeReceipt(@Req() request: AuthenticatedRequest) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '入库单已完成',
      data: await this.inventory.completeCurrentReceipt(user.organizationId, user.id),
    };
  }

  @Get('inventory-report')
  async inventoryReport(@Req() request: AuthenticatedRequest) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '总库存查询成功',
      data: await this.inventory.inventoryReport(user.organizationId, user.id),
    };
  }

  @Get('expiry-alerts')
  async expiryAlerts(
    @Req() request: AuthenticatedRequest,
    @Query('q') query?: string,
    @Query('level') level?: string,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '临期库存查询成功',
      data: await this.inventory.expiryAlerts(
        user.organizationId,
        user.id,
        query,
        level,
      ),
    };
  }

  @Get('movements')
  async movements(
    @Req() request: AuthenticatedRequest,
    @Query('q') query?: string,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '库存流水查询成功',
      data: await this.inventory.listMovements(user.organizationId, user.id, query),
    };
  }

  @Post('stocktake-adjustment')
  async stocktakeAdjustment(
    @Req() request: AuthenticatedRequest,
    @Body() input: StocktakeAdjustmentDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '盘点调整成功',
      data: await this.inventory.stocktakeAdjustment(user.organizationId, user.id, input),
    };
  }
}
