import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { ManagementService } from './management.service.js';

@Controller('management')
@UseGuards(JwtAuthGuard)
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Get('access')
  async access(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue?: string) {
    const storeId = this.storeId(storeIdValue);
    const user = request.inventoryUser!;
    return { code: 200, message: '经营管理权限查询成功', data: await this.management.access(user.organizationId, user.id, storeId) };
  }

  @Get('data-foundation')
  async dataFoundation(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue?: string,
  ) {
    if (!storeIdValue || !/^\d+$/.test(storeIdValue)) throw new BadRequestException('门店参数无效');
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '经营数据基础检查成功',
      data: await this.management.dataFoundation(user.organizationId, user.id, BigInt(storeIdValue)),
    };
  }

  @Get('pos-sync/check')
  async posDataCheck(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue?: string) {
    const storeId = this.storeId(storeIdValue);
    const user = request.inventoryUser!;
    return { code: 200, message: 'POS数据检查成功', data: await this.management.posDataCheck(user.organizationId, user.id, storeId) };
  }

  @Get('pos-sync/status')
  async posSyncStatus(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue?: string) {
    const storeId = this.storeId(storeIdValue);
    const user = request.inventoryUser!;
    return { code: 200, message: 'POS同步状态查询成功', data: await this.management.posSyncStatus(user.organizationId, user.id, storeId) };
  }

  @Get('pos-sync/issues')
  async posSyncIssues(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
  ) {
    const storeId = this.storeId(storeIdValue);
    const page = this.positiveInteger(pageValue, 1, '页码');
    const pageSize = this.positiveInteger(pageSizeValue, 20, '每页数量', 100);
    const user = request.inventoryUser!;
    return { code: 200, message: 'POS异常记录查询成功', data: await this.management.posSyncIssues(user.organizationId, user.id, storeId, page, pageSize) };
  }

  @Get('barcode-audit')
  async barcodeAudit(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue?: string) {
    const storeId = this.storeId(storeIdValue);
    const user = request.inventoryUser!;
    return { code: 200, message: '条码与商品映射审计成功', data: await this.management.barcodeAudit(user.organizationId, user.id, storeId) };
  }

  @Post('pos-sync/run')
  async runPosSync(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { date?: string; reconcile?: boolean },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!input?.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new BadRequestException('同步日期格式应为 YYYY-MM-DD');
    const [year, month, day] = input.date.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) throw new BadRequestException('同步日期不存在');
    if (input.reconcile !== undefined && typeof input.reconcile !== 'boolean') throw new BadRequestException('reconcile必须是布尔值');
    const user = request.inventoryUser!;
    return { code: 200, message: 'POS手动同步完成', data: await this.management.runPosSync(user.organizationId, user.id, storeId, input.date, input.reconcile ?? false) };
  }

  @Get('pos-inventory/preview')
  async previewPosInventory(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const storeId = this.storeId(storeIdValue);
    this.inventoryApplicationRange(from, to);
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS正式扣库预览生成成功，尚未修改库存',
      data: await this.management.previewPosInventoryApplication(
        user.organizationId, user.id, storeId, from!, to!,
      ),
    };
  }

  @Post('pos-inventory/apply')
  async applyPosInventory(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { from?: string; to?: string; confirm?: boolean },
  ) {
    const storeId = this.storeId(storeIdValue);
    this.inventoryApplicationRange(input?.from, input?.to);
    if (input.confirm !== true) throw new BadRequestException('正式扣库必须明确提交 confirm=true');
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS正常销售已写入正式库存流水',
      data: await this.management.applyPosInventory(
        user.organizationId, user.id, storeId, input.from!, input.to!,
      ),
    };
  }

  @Get('sales-analysis')
  async salesAnalysis(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dimension') dimensionValue?: string,
    @Query('brand') brand?: string,
    @Query('category') category?: string,
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!from || !this.isCalendarDate(from)) throw new BadRequestException('开始日期格式应为 YYYY-MM-DD');
    if (!to || !this.isCalendarDate(to)) throw new BadRequestException('结束日期格式应为 YYYY-MM-DD');
    if (from > to) throw new BadRequestException('开始日期不能晚于结束日期');
    const rangeDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
    if (rangeDays > 366) throw new BadRequestException('单次销售分析最多查询366天');
    const dimension = dimensionValue ?? 'DAY';
    if (!['DAY', 'WEEK', 'MONTH'].includes(dimension)) throw new BadRequestException('统计维度只能是 DAY、WEEK 或 MONTH');
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '销售分析查询成功',
      data: await this.management.salesAnalysis(user.organizationId, user.id, storeId, {
        from, to, dimension: dimension as 'DAY' | 'WEEK' | 'MONTH', brand: brand?.trim() || undefined, category: category?.trim() || undefined,
      }),
    };
  }

  @Get('products-brands')
  async productsBrands(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') query?: string,
    @Query('brand') brand?: string,
    @Query('category') category?: string,
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!from || !this.isCalendarDate(from)) throw new BadRequestException('开始日期格式应为 YYYY-MM-DD');
    if (!to || !this.isCalendarDate(to)) throw new BadRequestException('结束日期格式应为 YYYY-MM-DD');
    if (from > to) throw new BadRequestException('开始日期不能晚于结束日期');
    const rangeDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
    if (rangeDays > 366) throw new BadRequestException('单次商品分析最多查询366天');
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '商品与品牌分析查询成功',
      data: await this.management.productsBrandsAnalysis(user.organizationId, user.id, storeId, {
        from, to, query: query?.trim() || undefined, brand: brand?.trim() || undefined, category: category?.trim() || undefined,
      }),
    };
  }

  @Get('inventory-operations')
  async inventoryOperations(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue?: string,
    @Query('lookbackDays') lookbackDaysValue?: string,
    @Query('q') query?: string,
  ) {
    const storeId = this.storeId(storeIdValue);
    const lookbackDays = this.positiveInteger(lookbackDaysValue, 90, '观察天数', 365);
    if (lookbackDays < 30) throw new BadRequestException('观察天数不能少于30天');
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '库存经营分析查询成功',
      data: await this.management.inventoryOperations(user.organizationId, user.id, storeId, lookbackDays, query?.trim() || undefined),
    };
  }

  @Get('purchase-suggestions')
  async purchaseSuggestions(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue?: string) {
    const storeId = this.storeId(storeIdValue);
    const user = request.inventoryUser!;
    return { code: 200, message: '进货建议查询成功', data: await this.management.purchaseSuggestions(user.organizationId, user.id, storeId) };
  }

  @Post('inventory-operations/minimum-stock')
  async setMinimumStock(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { productId?: string; minimumStock?: number },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (input.productId && !/^\d+$/.test(input.productId)) throw new BadRequestException('商品参数无效');
    if (!Number.isInteger(input.minimumStock) || Number(input.minimumStock) < 0 || Number(input.minimumStock) > 100000) throw new BadRequestException('最低库存必须是0至100000之间的整数');
    const user = request.inventoryUser!;
    return { code: 200, message: input.productId ? '商品最低库存已更新' : '门店最低库存已统一更新', data: await this.management.setMinimumStock(user.organizationId, user.id, storeId, { productId: input.productId ? BigInt(input.productId) : undefined, minimumStock: Number(input.minimumStock) }) };
  }

  @Post('inventory-operations/visibility')
  async setInventoryVisibility(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { productId?: string; mode?: 'IGNORE' | 'NEXT_WEEK' },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!input.productId || !/^\d+$/.test(input.productId)) throw new BadRequestException('商品参数无效');
    if (input.mode !== 'IGNORE' && input.mode !== 'NEXT_WEEK') throw new BadRequestException('库存提醒处理方式无效');
    const hiddenUntil = input.mode === 'NEXT_WEEK' ? new Date(Date.now() + 7 * 86_400_000) : undefined;
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: input.mode === 'NEXT_WEEK' ? '该商品将在下周重新显示' : '该商品已从补货提醒中忽略',
      data: await this.management.setPurchaseSuggestionIgnored(
        user.organizationId,
        user.id,
        storeId,
        BigInt(input.productId),
        true,
        input.mode === 'NEXT_WEEK' ? '下周继续显示' : '无需补货提醒',
        hiddenUntil,
      ),
    };
  }

  @Get('purchase-orders/current')
  async currentPurchaseOrder(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue?: string) {
    const storeId = this.storeId(storeIdValue);
    const user = request.inventoryUser!;
    return { code: 200, message: '本周进货单查询成功', data: await this.management.currentPurchaseOrder(user.organizationId, user.id, storeId) };
  }

  @Post('purchase-suggestions/ignore')
  async ignorePurchaseSuggestion(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { productId?: string; reason?: string },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!input.productId || !/^\d+$/.test(input.productId)) throw new BadRequestException('商品参数无效');
    if (input.reason && input.reason.trim().length > 255) throw new BadRequestException('忽略原因不能超过255个字符');
    const user = request.inventoryUser!;
    return { code: 200, message: '进货建议已忽略', data: await this.management.setPurchaseSuggestionIgnored(user.organizationId, user.id, storeId, BigInt(input.productId), true, input.reason) };
  }

  @Post('purchase-suggestions/restore')
  async restorePurchaseSuggestion(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { productId?: string },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!input.productId || !/^\d+$/.test(input.productId)) throw new BadRequestException('商品参数无效');
    const user = request.inventoryUser!;
    return { code: 200, message: '进货建议已恢复', data: await this.management.setPurchaseSuggestionIgnored(user.organizationId, user.id, storeId, BigInt(input.productId), false) };
  }

  @Post('purchase-orders/items')
  async addPurchaseOrderItem(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { productId?: string; quantity?: number; source?: string },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!input.productId || !/^\d+$/.test(input.productId)) throw new BadRequestException('商品参数无效');
    const source = input.source ?? 'MANUAL';
    if (!['MANUAL', 'OUT_OF_STOCK', 'LOW_STOCK', 'HOT_SALES', 'WEEKLY_FORECAST'].includes(source)) throw new BadRequestException('加入来源无效');
    if (input.quantity !== undefined && (!Number.isInteger(input.quantity) || input.quantity <= 0)) throw new BadRequestException('进货数量必须是正整数');
    const user = request.inventoryUser!;
    return {
      code: 200, message: '商品已加入本周进货单',
      data: await this.management.addPurchaseOrderItem(user.organizationId, user.id, storeId, { productId: BigInt(input.productId), quantity: input.quantity, source: source as 'MANUAL' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'HOT_SALES' | 'WEEKLY_FORECAST' }),
    };
  }

  @Post('purchase-orders/items/update')
  async updatePurchaseOrderItem(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { itemId?: string; orderedQuantity?: number; supplierName?: string; unitCostCents?: number | null; caseSize?: number | null; notes?: string },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!input.itemId || !/^\d+$/.test(input.itemId)) throw new BadRequestException('进货单商品参数无效');
    if (!Number.isInteger(input.orderedQuantity) || Number(input.orderedQuantity) <= 0) throw new BadRequestException('进货数量必须是正整数');
    if (input.supplierName && input.supplierName.trim().length > 120) throw new BadRequestException('供应商名称不能超过120个字符');
    if (input.notes && input.notes.trim().length > 255) throw new BadRequestException('备注不能超过255个字符');
    const user = request.inventoryUser!;
    return { code: 200, message: '进货商品已更新', data: await this.management.updatePurchaseOrderItem(user.organizationId, user.id, storeId, BigInt(input.itemId), { orderedQuantity: Number(input.orderedQuantity), supplierName: input.supplierName, unitCostCents: input.unitCostCents, caseSize: input.caseSize, notes: input.notes }) };
  }

  @Post('purchase-orders/items/remove')
  async removePurchaseOrderItem(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue: string | undefined, @Body() input: { itemId?: string }) {
    const storeId = this.storeId(storeIdValue);
    if (!input.itemId || !/^\d+$/.test(input.itemId)) throw new BadRequestException('进货单商品参数无效');
    const user = request.inventoryUser!;
    return { code: 200, message: '商品已从本周进货单移除', data: await this.management.removePurchaseOrderItem(user.organizationId, user.id, storeId, BigInt(input.itemId)) };
  }

  @Post('purchase-orders/status')
  async transitionPurchaseOrder(@Req() request: AuthenticatedRequest, @Query('storeId') storeIdValue: string | undefined, @Body() input: { status?: string }) {
    const storeId = this.storeId(storeIdValue);
    if (!input.status || !['DRAFT', 'CONFIRMED', 'ORDERED', 'CANCELLED'].includes(input.status)) throw new BadRequestException('进货单状态无效');
    const user = request.inventoryUser!;
    return { code: 200, message: '进货单状态已更新', data: await this.management.transitionPurchaseOrder(user.organizationId, user.id, storeId, input.status as 'DRAFT' | 'CONFIRMED' | 'ORDERED' | 'CANCELLED') };
  }

  @Get('store-comparison')
  async storeComparison(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!from || !this.isCalendarDate(from)) throw new BadRequestException('开始日期格式应为 YYYY-MM-DD');
    if (!to || !this.isCalendarDate(to)) throw new BadRequestException('结束日期格式应为 YYYY-MM-DD');
    if (from > to) throw new BadRequestException('开始日期不能晚于结束日期');
    const rangeDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
    if (rangeDays > 366) throw new BadRequestException('单次门店对比最多查询366天');
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '门店经营对比查询成功',
      data: await this.management.storeComparison(user.organizationId, user.id, storeId, from, to),
    };
  }

  @Get('product-insight-tags')
  async productInsightTags(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue?: string,
    @Query('q') query?: string,
  ) {
    const storeId = this.storeId(storeIdValue);
    const user = request.inventoryUser!;
    return { code: 200, message: '商品消费倾向标签查询成功', data: await this.management.productInsightTags(user.organizationId, user.id, storeId, query?.trim() || undefined) };
  }

  @Post('product-insight-tags/assign')
  async assignProductInsightTag(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { productId?: string; tagCode?: string; tagName?: string; dimension?: string; confidence?: string; evidence?: string },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!input.productId || !/^\d+$/.test(input.productId)) throw new BadRequestException('商品参数无效');
    if (!input.tagCode || !/^[a-z][a-z0-9._-]{2,79}$/.test(input.tagCode)) throw new BadRequestException('标签代码格式无效');
    if (!input.tagName?.trim() || input.tagName.trim().length > 120) throw new BadRequestException('标签名称无效');
    if (!input.dimension || !['BUSINESS_CATEGORY', 'AUDIENCE', 'HEALTH_NEED', 'USE_CASE', 'OPERATION', 'MARKETING'].includes(input.dimension)) throw new BadRequestException('标签维度无效');
    const confidence = input.confidence ?? 'MEDIUM';
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(confidence)) throw new BadRequestException('置信度无效');
    if (input.evidence && input.evidence.trim().length > 255) throw new BadRequestException('判断依据不能超过255个字符');
    const user = request.inventoryUser!;
    return {
      code: 200, message: '商品消费倾向标签保存成功',
      data: await this.management.assignProductInsightTag(user.organizationId, user.id, storeId, {
        productId: BigInt(input.productId), tagCode: input.tagCode, tagName: input.tagName.trim(),
        dimension: input.dimension as 'BUSINESS_CATEGORY' | 'AUDIENCE' | 'HEALTH_NEED' | 'USE_CASE' | 'OPERATION' | 'MARKETING', confidence: confidence as 'LOW' | 'MEDIUM' | 'HIGH', evidence: input.evidence?.trim() || undefined,
      }),
    };
  }

  @Post('product-insight-tags/definitions')
  async saveProductInsightTagDefinition(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { id?: string; name?: string; dimension?: string; parentId?: string | null; description?: string; sortOrder?: number; status?: string },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (input.id && !/^\d+$/.test(input.id)) throw new BadRequestException('标签参数无效');
    if (!input.name?.trim() || input.name.trim().length > 120) throw new BadRequestException('标签名称无效');
    if (!input.dimension || !['BUSINESS_CATEGORY', 'AUDIENCE', 'HEALTH_NEED', 'USE_CASE', 'OPERATION', 'MARKETING'].includes(input.dimension)) throw new BadRequestException('标签维度无效');
    if (input.parentId && !/^\d+$/.test(input.parentId)) throw new BadRequestException('上级标签参数无效');
    if (input.description && input.description.trim().length > 255) throw new BadRequestException('标签说明不能超过255个字符');
    if (input.status && !['ACTIVE', 'INACTIVE'].includes(input.status)) throw new BadRequestException('标签状态无效');
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: input.id ? '标签已更新' : '标签已创建',
      data: await this.management.saveProductInsightTagDefinition(user.organizationId, user.id, storeId, {
        id: input.id ? BigInt(input.id) : undefined,
        name: input.name.trim(),
        dimension: input.dimension as 'BUSINESS_CATEGORY' | 'AUDIENCE' | 'HEALTH_NEED' | 'USE_CASE' | 'OPERATION' | 'MARKETING',
        parentId: input.parentId ? BigInt(input.parentId) : null,
        description: input.description?.trim() || undefined,
        sortOrder: typeof input.sortOrder === 'number' && Number.isInteger(input.sortOrder) ? input.sortOrder : 0,
        status: (input.status ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
      }),
    };
  }

  @Post('product-insight-tags/import')
  async importProductInsightTags(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue: string | undefined,
    @Body() input: { categories?: { externalId?: string; name?: string; dimension?: string; parentExternalId?: string | null; description?: string; sortOrder?: number; status?: string }[] },
  ) {
    const storeId = this.storeId(storeIdValue);
    if (!Array.isArray(input.categories) || !input.categories.length || input.categories.length > 1000) throw new BadRequestException('一次需导入1至1000个分类');
    const dimensions = ['BUSINESS_CATEGORY', 'AUDIENCE', 'HEALTH_NEED', 'USE_CASE', 'OPERATION', 'MARKETING'];
    const seen = new Set<string>();
    const categories = input.categories.map((item, index) => {
      const externalId = item.externalId?.trim();
      const name = item.name?.trim();
      if (!externalId || externalId.length > 64) throw new BadRequestException(`第${index + 1}项分类ID无效`);
      if (seen.has(externalId)) throw new BadRequestException(`分类ID重复：${externalId}`);
      seen.add(externalId);
      if (!name || name.length > 120) throw new BadRequestException(`第${index + 1}项名称无效`);
      if (!item.dimension || !dimensions.includes(item.dimension)) throw new BadRequestException(`第${index + 1}项标签类型无效`);
      if (item.description && item.description.trim().length > 255) throw new BadRequestException(`第${index + 1}项说明过长`);
      if (item.status && !['ACTIVE', 'INACTIVE'].includes(item.status)) throw new BadRequestException(`第${index + 1}项状态无效`);
      return { externalId, name, dimension: item.dimension as 'BUSINESS_CATEGORY' | 'AUDIENCE' | 'HEALTH_NEED' | 'USE_CASE' | 'OPERATION' | 'MARKETING', parentExternalId: item.parentExternalId?.trim() || null, description: item.description?.trim() || undefined, sortOrder: typeof item.sortOrder === 'number' && Number.isInteger(item.sortOrder) ? item.sortOrder : index, status: (item.status ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE' };
    });
    for (const item of categories) if (item.parentExternalId && !seen.has(item.parentExternalId)) throw new BadRequestException(`找不到上级分类：${item.parentExternalId}`);
    const user = request.inventoryUser!;
    return { code: 200, message: '小程序分类导入完成', data: await this.management.importProductInsightTags(user.organizationId, user.id, storeId, categories) };
  }

  @Get('overview')
  async overview(
    @Req() request: AuthenticatedRequest,
    @Query('storeId') storeIdValue?: string,
    @Query('date') date?: string,
  ) {
    if (!storeIdValue || !/^\d+$/.test(storeIdValue)) throw new BadRequestException('门店参数无效');
    if (date && !this.isCalendarDate(date)) throw new BadRequestException('日期格式应为 YYYY-MM-DD');
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: '经营数据查询成功',
      data: await this.management.overview(user.organizationId, user.id, BigInt(storeIdValue), date),
    };
  }

  private storeId(value?: string) {
    if (!value || !/^\d+$/.test(value)) throw new BadRequestException('门店参数无效');
    return BigInt(value);
  }

  private positiveInteger(value: string | undefined, fallback: number, label: string, maximum = Number.MAX_SAFE_INTEGER) {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) throw new BadRequestException(`${label}无效`);
    return Number(value);
  }

  private isCalendarDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  private inventoryApplicationRange(from?: string, to?: string) {
    if (!from || !this.isCalendarDate(from)) throw new BadRequestException('扣库开始日期格式应为 YYYY-MM-DD');
    if (!to || !this.isCalendarDate(to)) throw new BadRequestException('扣库结束日期格式应为 YYYY-MM-DD');
    if (from > to) throw new BadRequestException('扣库开始日期不能晚于结束日期');
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
    if (days > 31) throw new BadRequestException('单次正式扣库最多处理31天');
  }
}
