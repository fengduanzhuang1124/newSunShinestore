import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { StockDecreaseDto, StockIncreaseDto, StocktakeAdjustmentDto } from './stocktake-adjustment.dto.js';
import { ReverseMovementDto } from './reverse-movement.dto.js';
import { InventoryMaintenanceService } from './inventory-maintenance.service.js';
import { CorrectBatchExpiryDto, DeleteExpiryAlertDto, ExpiryAlertActionDto, ExpiryAlertActionStatusDto } from './inventory-maintenance.dto.js';
import { WarehouseLocationService } from './warehouse-location.service.js';
import { AssignWarehouseLocationDto, SaveWarehouseLocationDto } from './warehouse-location.dto.js';
import { StockCountService } from './stock-count.service.js';
import { AddStockCountItemDto, ConfirmStockCountDto } from './stock-count.dto.js';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly queries: InventoryQueryService,
    private readonly receiving: ReceivingService,
    private readonly issuing: IssuingService,
    private readonly movementCommands: MovementService,
    private readonly stocktakes: StocktakeService,
    private readonly maintenance: InventoryMaintenanceService,
    private readonly locations: WarehouseLocationService,
    private readonly stockCounts: StockCountService,
  ) {}

  @Get('count-tasks/current/summary')
  async stockCountSummary(@Req() request: AuthenticatedRequest) {
    const user = request.inventoryUser!;
    return { code: 200, message: '盘点任务进度查询成功', data: await this.stockCounts.summary(user.organizationId, user.id) };
  }

  @Get('count-tasks/current')
  async currentStockCount(@Req() request: AuthenticatedRequest) {
    const user = request.inventoryUser!;
    return { code: 200, message: '盘点任务查询成功', data: await this.stockCounts.current(user.organizationId, user.id) };
  }

  @Post('count-tasks/:taskId/items')
  async addStockCountItem(@Req() request: AuthenticatedRequest, @Param('taskId') taskId: string, @Body() input: AddStockCountItemDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '已加入盘点任务', data: await this.stockCounts.addItem(user.organizationId, user.id, taskId, input) };
  }

  @Post('count-tasks/:taskId/items/:itemId/confirm')
  async confirmStockCount(@Req() request: AuthenticatedRequest, @Param('taskId') taskId: string, @Param('itemId') itemId: string, @Body() input: ConfirmStockCountDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '盘点已确认', data: await this.stockCounts.confirm(user.organizationId, user.id, taskId, itemId, input) };
  }

  @Get('locations')
  async warehouseLocations(@Req() request: AuthenticatedRequest) {
    const user = request.inventoryUser!;
    return { code: 200, message: '仓位查询成功', data: await this.locations.list(user.organizationId, user.id) };
  }

  @Post('locations')
  async createWarehouseLocation(@Req() request: AuthenticatedRequest, @Body() input: SaveWarehouseLocationDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '仓位创建成功', data: await this.locations.create(user.organizationId, user.id, input) };
  }

  @Patch('locations/:locationId')
  async updateWarehouseLocation(@Req() request: AuthenticatedRequest, @Param('locationId') locationId: string, @Body() input: SaveWarehouseLocationDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '仓位更新成功', data: await this.locations.update(user.organizationId, user.id, locationId, input) };
  }

  @Put('locations/assignment')
  async assignWarehouseLocation(@Req() request: AuthenticatedRequest, @Body() input: AssignWarehouseLocationDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '商品仓位已更新', data: await this.locations.assign(user.organizationId, user.id, input) };
  }

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

  @Get('review-items')
  async reviewItems(@Req() request: AuthenticatedRequest) {
    const user = request.inventoryUser!;
    return { code: 200, message: '待核查项目查询成功', data: await this.queries.reviewItems(user.organizationId, user.id) };
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

  @Patch('batches/:batchId/expiry')
  async correctBatchExpiry(@Req() request: AuthenticatedRequest, @Param('batchId') batchId: string, @Body() input: CorrectBatchExpiryDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '到期日期已修正', data: await this.maintenance.correctBatchExpiry(user.organizationId, user.id, batchId, input) };
  }

  @Put('expiry-alerts/:batchId/action')
  async saveExpiryAction(@Req() request: AuthenticatedRequest, @Param('batchId') batchId: string, @Body() input: ExpiryAlertActionDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '临期处理方式已保存', data: await this.maintenance.saveExpiryAction(user.organizationId, user.id, batchId, input) };
  }

  @Patch('expiry-alerts/:batchId/action/status')
  async changeExpiryActionStatus(@Req() request: AuthenticatedRequest, @Param('batchId') batchId: string, @Body() input: ExpiryAlertActionStatusDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '临期处理状态已更新', data: await this.maintenance.changeExpiryActionStatus(user.organizationId, user.id, batchId, input) };
  }

  @Delete('expiry-alerts/:batchId/action')
  async deleteExpiryAction(@Req() request: AuthenticatedRequest, @Param('batchId') batchId: string) {
    const user = request.inventoryUser!;
    return { code: 200, message: '临期处理任务已删除', data: await this.maintenance.deleteExpiryAction(user.organizationId, user.id, batchId) };
  }

  @Delete('expiry-alerts/:batchId')
  async hideExpiryAlert(@Req() request: AuthenticatedRequest, @Param('batchId') batchId: string, @Body() input: DeleteExpiryAlertDto) {
    const user = request.inventoryUser!;
    return { code: 200, message: '临期预警已删除', data: await this.maintenance.hideExpiryAlert(user.organizationId, user.id, batchId, input) };
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

  @Post('stock-decrease')
  async decreaseStock(
    @Req() request: AuthenticatedRequest,
    @Body() input: StockDecreaseDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '库存减少成功',
      data: await this.stocktakes.decreaseStock(user.organizationId, user.id, input),
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
