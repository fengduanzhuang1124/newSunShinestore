import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';

@Injectable()
export class InventoryQueryService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService) {}

  private localDate(timeZone: string, now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  private dateValue(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('日期格式必须为 YYYY-MM-DD');
    }
    const value = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('日期不是有效的日历日期');
    }
    return value;
  }

  private addUtcMonths(value: Date, months: number) {
    const result = new Date(value);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
  }

  private serializeProduct(
    product: {
      id: bigint;
      name: string;
      sku: string | null;
      englishName: string | null;
      chineseName: string | null;
      barcodes: Array<{ barcode: string }>;
      batches: Array<{
        id: bigint;
        expiryDate: Date;
        expiryPrecision: 'MONTH' | 'DATE';
        inventoryBalances: Array<{ quantity: number }>;
      }>;
    },
  ) {
    const batches = product.batches.map((batch) => ({
      batchId: batch.id.toString(),
      expiryDate: batch.expiryPrecision === 'MONTH'
        ? batch.expiryDate.toISOString().slice(0, 7)
        : batch.expiryDate.toISOString().slice(0, 10),
      expiryPrecision: batch.expiryPrecision,
      quantity: batch.inventoryBalances[0]?.quantity ?? 0,
    }));
    return {
      productId: product.id.toString(),
      productName: product.name,
      sku: product.sku,
      englishName: product.englishName,
      chineseName: product.chineseName,
      barcodes: product.barcodes.map(({ barcode }) => barcode),
      batches,
      totalQuantity: batches.reduce((sum, batch) => sum + batch.quantity, 0),
    };
  }

  async search(organizationId: bigint, userId: bigint, rawQuery: string) {
    const permission = await this.permissions.warehousePermission(
      organizationId,
      userId,
      'canView',
    );
    const query = rawQuery.trim();
    if (!query) {
      throw new BadRequestException('请输入商品名称或条码');
    }
    const products = await this.prisma.client.product.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        OR: [
          { name: { contains: query } },
          { sku: { contains: query } },
          { englishName: { contains: query } },
          { chineseName: { contains: query } },
          { barcodes: { some: { barcode: { contains: query }, status: 'ACTIVE' } } },
        ],
      },
      take: 20,
      orderBy: { name: 'asc' },
      include: {
        barcodes: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } },
        batches: {
          orderBy: { expiryDate: 'asc' },
          include: {
            inventoryBalances: { where: { warehouseId: permission.warehouseId } },
          },
        },
      },
    });
    return {
      warehouseId: permission.warehouseId.toString(),
      warehouseName: permission.warehouse.name,
      products: products.map((product) => this.serializeProduct(product)),
    };
  }

  async findByBarcode(organizationId: bigint, userId: bigint, barcode: string) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');

    const productBarcode = await this.prisma.client.productBarcode.findUnique({
      where: {
        organizationId_barcode: { organizationId, barcode },
      },
      include: {
        product: {
          include: {
            barcodes: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } },
            batches: {
              orderBy: { expiryDate: 'asc' },
              include: {
                inventoryBalances: {
                  where: { warehouseId: permission.warehouseId },
                },
              },
            },
          },
        },
      },
    });

    if (!productBarcode) {
      throw new NotFoundException('条码尚未建立商品');
    }

    const serialized = this.serializeProduct(productBarcode.product);
    return {
      barcode: productBarcode.barcode,
      ...serialized,
      warehouseId: permission.warehouseId.toString(),
      warehouseName: permission.warehouse.name,
    };
  }

  async inventoryReport(organizationId: bigint, userId: bigint) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const products = await this.prisma.client.product.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        inventoryBalances: { some: { warehouseId: permission.warehouseId, quantity: { gt: 0 } } },
      },
      orderBy: { name: 'asc' },
      include: {
        barcodes: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } },
        batches: {
          where: {
            inventoryBalances: {
              some: { warehouseId: permission.warehouseId, quantity: { gt: 0 } },
            },
          },
          orderBy: { expiryDate: 'asc' },
          include: { inventoryBalances: { where: { warehouseId: permission.warehouseId, quantity: { gt: 0 } } } },
        },
      },
    });
    const serialized = products.map((product) => this.serializeProduct(product));
    return {
      warehouseName: permission.warehouse.name,
      productCount: serialized.length,
      totalQuantity: serialized.reduce((sum, product) => sum + product.totalQuantity, 0),
      products: serialized,
    };
  }

  async expiryAlerts(
    organizationId: bigint,
    userId: bigint,
    rawQuery = '',
    requestedLevel = '',
  ) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { expiryAlertSettings: true },
    });
    const settings = organization.expiryAlertSettings ?? {
      urgentMonths: 2,
      warningMonths: 3,
      earlyWarningMonths: 6,
      urgentLabel: '紧急临期',
      warningLabel: '临期预警',
      earlyWarningLabel: '提前关注',
      expiredLabel: '已过期',
    };
    const allowedLevels = ['EXPIRED', 'URGENT', 'WARNING', 'EARLY'];
    const levelFilter = requestedLevel.trim().toUpperCase();
    if (levelFilter && !allowedLevels.includes(levelFilter)) {
      throw new BadRequestException('临期级别不正确');
    }
    const todayText = this.localDate(organization.timezone);
    const today = this.dateValue(todayText);
    const urgentEnd = this.addUtcMonths(today, settings.urgentMonths);
    const warningEnd = this.addUtcMonths(today, settings.warningMonths);
    const earlyEnd = this.addUtcMonths(today, settings.earlyWarningMonths);
    const query = rawQuery.trim();
    const balances = await this.prisma.client.inventoryBalance.findMany({
      where: {
        organizationId,
        warehouseId: permission.warehouseId,
        quantity: { gt: 0 },
        batch: { expiryDate: { lte: earlyEnd } },
        product: {
          status: 'ACTIVE',
          ...(query ? {
            OR: [
              { name: { contains: query } },
              { barcodes: { some: { barcode: { contains: query }, status: 'ACTIVE' } } },
            ],
          } : {}),
        },
      },
      orderBy: { batch: { expiryDate: 'asc' } },
      include: {
        product: {
          select: {
            name: true,
            barcodes: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } },
          },
        },
        batch: { select: { expiryDate: true, expiryPrecision: true } },
      },
    });
    const labels: Record<string, string> = {
      EXPIRED: settings.expiredLabel,
      URGENT: settings.urgentLabel,
      WARNING: settings.warningLabel,
      EARLY: settings.earlyWarningLabel,
    };
    const classifiedItems = balances.map((balance) => {
      const expiryDate = balance.batch.expiryDate;
      const level = expiryDate < today
        ? 'EXPIRED'
        : expiryDate <= urgentEnd
          ? 'URGENT'
          : expiryDate <= warningEnd
            ? 'WARNING'
            : 'EARLY';
      return {
        productId: balance.productId.toString(),
        productName: balance.product.name,
        barcodes: balance.product.barcodes.map(({ barcode }) => barcode),
        batchId: balance.batchId.toString(),
        expiryDate: balance.batch.expiryPrecision === 'MONTH'
          ? expiryDate.toISOString().slice(0, 7)
          : expiryDate.toISOString().slice(0, 10),
        expiryPrecision: balance.batch.expiryPrecision,
        quantity: balance.quantity,
        level,
        levelLabel: labels[level],
        daysRemaining: Math.ceil((expiryDate.getTime() - today.getTime()) / 86_400_000),
      };
    });
    const items = classifiedItems.filter((item) => !levelFilter || item.level === levelFilter);
    return {
      today: todayText,
      warehouseName: permission.warehouse.name,
      thresholds: {
        urgentMonths: settings.urgentMonths,
        warningMonths: settings.warningMonths,
        earlyWarningMonths: settings.earlyWarningMonths,
      },
      summary: Object.fromEntries(allowedLevels.map((level) => [
        level,
        classifiedItems.filter((item) => item.level === level).length,
      ])),
      items,
    };
  }

  async listMovements(organizationId: bigint, userId: bigint, rawQuery = '') {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const isAdmin = Boolean(await this.prisma.client.userStoreRole.findFirst({
      where: {
        userId,
        storeId: permission.warehouse.storeId,
        store: { organizationId },
        role: { code: 'ADMIN' },
      },
      select: { userId: true },
    }));
    const query = rawQuery.trim();
    const movements = await this.prisma.client.stockMovement.findMany({
      where: {
        organizationId,
        warehouseId: permission.warehouseId,
        ...(query ? {
          OR: [
            { movementNo: { contains: query } },
            { product: { name: { contains: query } } },
            { product: { barcodes: { some: { barcode: { contains: query }, status: 'ACTIVE' } } } },
          ],
        } : {}),
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true, barcodes: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } } } },
        batch: { select: { expiryDate: true, expiryPrecision: true } },
        performedBy: { select: { displayName: true } },
        reversalOf: { select: { movementNo: true } },
        reversedBy: { select: { movementNo: true } },
      },
    });
    const labels: Record<string, string> = {
      RECEIPT: '入库', MANUAL_ISSUE: '出库', STOCKTAKE_GAIN: '盘盈', STOCKTAKE_LOSS: '盘亏',
      DAMAGE: '破损', EXPIRED: '过期处理', RETURN_IN: '退货入库', RETURN_TO_SUPPLIER: '退供应商',
      TRANSFER_IN: '调拨入库', TRANSFER_OUT: '调拨出库', REVERSAL: '冲销', INITIAL_STOCK: '初始库存',
    };
    return {
      warehouseName: permission.warehouse.name,
      movements: movements.map((movement) => ({
        movementId: movement.id.toString(),
        movementNo: movement.movementNo,
        movementType: movement.movementType,
        movementLabel: labels[movement.movementType] ?? movement.movementType,
        productName: movement.product.name,
        barcodes: movement.product.barcodes.map(({ barcode }) => barcode),
        expiryDate: movement.batch.expiryPrecision === 'MONTH'
          ? movement.batch.expiryDate.toISOString().slice(0, 7)
          : movement.batch.expiryDate.toISOString().slice(0, 10),
        quantityDelta: movement.quantityDelta,
        reason: movement.reason,
        performedBy: movement.performedBy.displayName,
        reversalOfMovementNo: movement.reversalOf?.movementNo ?? null,
        reversedByMovementNo: movement.reversedBy?.movementNo ?? null,
        reversed: Boolean(movement.reversedBy),
        canReverse: isAdmin
          && ['RECEIPT', 'MANUAL_ISSUE'].includes(movement.movementType)
          && !movement.reversedBy,
        createdAt: movement.createdAt.toISOString(),
      })),
    };
  }
}
