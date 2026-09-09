import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import {
  PosMappingQueryDto,
  PosMilkCatalogQueryDto,
  PosOrderQueryDto,
  PosReviewQueryDto,
  PosSimulationQueryDto,
  PosStoreQueryDto,
} from './application/pos-query.dto.js';
import { PosQueryService } from './application/pos-query.service.js';
import { PosMilkCatalogService } from './application/pos-milk-catalog.service.js';
import { ReviewMilkProductDto } from './application/review-milk-product.dto.js';

@Controller('pos')
@UseGuards(JwtAuthGuard)
export class PosController {
  constructor(
    private readonly pos: PosQueryService,
    private readonly milkCatalog: PosMilkCatalogService,
  ) {}

  @Post('milk-products/import')
  async importMilkProducts(
    @Req() request: AuthenticatedRequest,
    @Query() query: PosStoreQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS奶粉候选商品导入成功',
      data: await this.milkCatalog.importCandidates(
        user.organizationId,
        user.id,
        query.storeId,
      ),
    };
  }

  @Patch('milk-products/:candidateId/review')
  async reviewMilkProduct(
    @Req() request: AuthenticatedRequest,
    @Param('candidateId') candidateId: string,
    @Query() query: PosStoreQueryDto,
    @Body() input: ReviewMilkProductDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: input.reviewStatus === 'APPROVED' ? '奶粉商品审核通过' : '奶粉商品已忽略',
      data: await this.milkCatalog.reviewCandidate(
        user.organizationId,
        user.id,
        query.storeId,
        candidateId,
        input,
      ),
    };
  }

  @Get('milk-products')
  async milkProducts(
    @Req() request: AuthenticatedRequest,
    @Query() query: PosMilkCatalogQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS奶粉候选商品查询成功',
      data: await this.milkCatalog.candidates(user.organizationId, user.id, query),
    };
  }

  @Get('milk-products/:candidateId')
  async milkProduct(
    @Req() request: AuthenticatedRequest,
    @Param('candidateId') candidateId: string,
    @Query() query: PosStoreQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS奶粉候选商品详情查询成功',
      data: await this.milkCatalog.candidate(
        user.organizationId,
        user.id,
        query.storeId,
        candidateId,
      ),
    };
  }

  @Get('sync-status')
  async syncStatus(
    @Req() request: AuthenticatedRequest,
    @Query() query: PosStoreQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS同步状态查询成功',
      data: await this.pos.syncStatus(user.organizationId, user.id, query.storeId),
    };
  }

  @Get('orders')
  async orders(
    @Req() request: AuthenticatedRequest,
    @Query() query: PosOrderQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS订单查询成功',
      data: await this.pos.orders(user.organizationId, user.id, query),
    };
  }

  @Get('orders/:orderId')
  async orderDetail(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Query() query: PosStoreQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS订单详情查询成功',
      data: await this.pos.orderDetail(
        user.organizationId,
        user.id,
        query.storeId,
        orderId,
      ),
    };
  }

  @Get('product-mappings')
  async mappings(
    @Req() request: AuthenticatedRequest,
    @Query() query: PosMappingQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS商品映射查询成功',
      data: await this.pos.mappings(user.organizationId, user.id, query),
    };
  }

  @Get('simulations')
  async simulations(
    @Req() request: AuthenticatedRequest,
    @Query() query: PosSimulationQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS模拟库存查询成功',
      data: await this.pos.simulations(user.organizationId, user.id, query),
    };
  }

  @Get('simulations/:simulationId')
  async simulationDetail(
    @Req() request: AuthenticatedRequest,
    @Param('simulationId') simulationId: string,
    @Query() query: PosStoreQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS模拟库存详情查询成功',
      data: await this.pos.simulationDetail(
        user.organizationId,
        user.id,
        query.storeId,
        simulationId,
      ),
    };
  }

  @Get('reviews')
  async reviews(
    @Req() request: AuthenticatedRequest,
    @Query() query: PosReviewQueryDto,
  ) {
    const user = request.inventoryUser!;
    return {
      code: 200,
      message: 'POS异常审核查询成功',
      data: await this.pos.reviews(user.organizationId, user.id, query),
    };
  }
}
