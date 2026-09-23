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
import { InventoryQueryService } from './inventory-query.service.js';
import { ReceivingService } from './receiving.service.js';
import { IssuingService } from './issuing.service.js';
import { MovementService } from './movement.service.js';
import { StocktakeService } from './stocktake.service.js';
import { ScanReceiveDto } from './scan-receive.dto.js';
import { ManualIssueDto } from './manual-issue.dto.js';
import { StockIncreaseDto, StocktakeAdjustmentDto } from './stocktake-adjustment.dto.js';
import { ReverseMovementDto } from './reverse-movement.dto.js';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly queries: InventoryQueryService,
    private readonly receiving: ReceivingService,
    private readonly issuing: IssuingService,
    private readonly movementCommands: MovementService,
    private readonly stocktakes: StocktakeService,
  ) {}

  @Get('search')
  async search(
    @Req() request: AuthenticatedRequest,
    @Query('q') query: string,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '查询成功',
      data: await this.queries.search(
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
      data: await this.queries.findByBarcode(
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
      data: await this.receiving.receive(user.organizationId, user.id, input),
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
      data: await this.issuing.issueToShelf(
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
      data: await this.receiving.listReceipts(user.organizationId, user.id, date),
    };
  }

  @Post('receipts/current/complete')
  async completeReceipt(@Req() request: AuthenticatedRequest) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '入库单已完成',
      data: await this.receiving.completeCurrentReceipt(user.organizationId, user.id),
    };
  }

  @Get('inventory-report')
  async inventoryReport(@Req() request: AuthenticatedRequest) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '总库存查询成功',
      data: await this.queries.inventoryReport(user.organizationId, user.id),
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
      data: await this.queries.expiryAlerts(
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
      data: await this.queries.listMovements(user.organizationId, user.id, query),
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
      data: await this.stocktakes.stocktakeAdjustment(user.organizationId, user.id, input),
    };
  }

  @Post('stock-increase')
  async increaseStock(
    @Req() request: AuthenticatedRequest,
    @Body() input: StockIncreaseDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '库存增加成功',
      data: await this.stocktakes.increaseStock(user.organizationId, user.id, input),
    };
  }

  @Post('movements/:movementId/reverse')
  async reverseMovement(
    @Req() request: AuthenticatedRequest,
    @Param('movementId') movementId: string,
    @Body() input: ReverseMovementDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '库存流水已撤销',
      data: await this.movementCommands.reverseMovement(
        user.organizationId,
        user.id,
        movementId,
        input,
      ),
    };
  }
}
