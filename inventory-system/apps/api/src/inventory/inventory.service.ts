import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { ScanReceiveDto } from './scan-receive.dto.js';
import { ManualIssueDto } from './manual-issue.dto.js';
import { StocktakeAdjustmentDto } from './stocktake-adjustment.dto.js';
import { ReverseMovementDto } from './reverse-movement.dto.js';
import { parseExpiryInput } from './expiry-date.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async warehousePermission(
    organizationId: bigint,
    userId: bigint,
    capability: 'canView' | 'canReceive' | 'canIssue' | 'canCount',
  ) {
    const permission = await this.prisma.client.userWarehousePermission.findFirst({
      where: {
        userId,
        [capability]: true,
        warehouse: { store: { organizationId } },
      },
      include: { warehouse: true },
    });
    if (!permission) {
      throw new ForbiddenException('没有当前仓库操作权限');
    }
    return permission;
  }

  private async requireStoreAdmin(
    organizationId: bigint,
    userId: bigint,
    storeId: bigint,
  ) {
    const role = await this.prisma.client.userStoreRole.findFirst({
      where: {
        userId,
        storeId,
        store: { organizationId },
        role: { code: 'ADMIN' },
      },
      select: { userId: true },
    });
    if (!role) throw new ForbiddenException('只有门店管理员可以撤销库存流水');
  }

  private serializeProduct(
    product: {
      id: bigint;
      name: string;
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
      barcodes: product.barcodes.map(({ barcode }) => barcode),
      batches,
      totalQuantity: batches.reduce((sum, batch) => sum + batch.quantity, 0),
    };
  }

  async search(organizationId: bigint, userId: bigint, rawQuery: string) {
    const permission = await this.warehousePermission(
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
    const permission = await this.warehousePermission(organizationId, userId, 'canView');

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

  async receive(
    organizationId: bigint,
    userId: bigint,
    input: ScanReceiveDto,
  ) {
    const permission = await this.warehousePermission(
      organizationId,
      userId,
      'canReceive',
    );

    const { expiryDate, expiryDisplay, expiryPrecision } = parseExpiryInput(
      input.expiryMonth,
      input.expiryDay,
    );
    return this.prisma.client.$transaction(async (transaction) => {
      const organization = await transaction.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { timezone: true },
      });
      const receiptDateText = this.localDate(organization.timezone);
      const receiptDate = this.dateValue(receiptDateText);
      let receipt = await transaction.stockReceipt.findFirst({
        where: {
          organizationId,
          warehouseId: permission.warehouseId,
          openedById: userId,
          receiptDate,
          status: 'OPEN',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!receipt) {
        receipt = await transaction.stockReceipt.create({
          data: {
            receiptNo: `RK-${receiptDateText.replaceAll('-', '')}-${randomUUID().slice(0, 6).toUpperCase()}`,
            organizationId,
            storeId: permission.warehouse.storeId,
            warehouseId: permission.warehouseId,
            receiptDate,
            openedById: userId,
          },
        });
      }
      let productBarcode = await transaction.productBarcode.findUnique({
        where: {
          organizationId_barcode: {
            organizationId,
            barcode: input.barcode,
          },
        },
        include: { product: true },
      });

      if (!productBarcode) {
        const selectedProduct = await transaction.product.findFirst({
          where: input.productId
            ? { id: BigInt(input.productId), organizationId, status: 'ACTIVE' }
            : { organizationId, name: input.productName, status: 'ACTIVE' },
          orderBy: { id: 'asc' },
        });
        if (input.productId && !selectedProduct) {
          throw new NotFoundException('选择的已有商品不存在');
        }
        const product = selectedProduct ?? await transaction.product.create({
          data: {
            organizationId,
            sku: `AUTO-${randomUUID().slice(0, 12)}`,
            name: input.productName,
          },
        });
        productBarcode = await transaction.productBarcode.create({
          data: {
            organizationId,
            productId: product.id,
            barcode: input.barcode,
            isPrimary: true,
          },
          include: { product: true },
        });
        await transaction.storeProduct.upsert({
          where: {
            storeId_productId: {
              storeId: permission.warehouse.storeId,
              productId: product.id,
            },
          },
          update: { enabled: true },
          create: { storeId: permission.warehouse.storeId, productId: product.id },
        });
      } else if (productBarcode.product.name !== input.productName) {
        await transaction.product.update({
          where: { id: productBarcode.productId },
          data: { name: input.productName },
        });
      }

      const batch = await transaction.productBatch.upsert({
        where: {
          organizationId_productId_expiryDate_expiryPrecision: {
            organizationId,
            productId: productBarcode.productId,
            expiryDate,
            expiryPrecision,
          },
        },
        update: {},
        create: {
          organizationId,
          productId: productBarcode.productId,
          expiryDate,
          expiryPrecision,
          createdById: userId,
        },
      });

      const balance = await transaction.inventoryBalance.upsert({
        where: {
          organizationId_warehouseId_productId_batchId: {
            organizationId,
            warehouseId: permission.warehouseId,
            productId: productBarcode.productId,
            batchId: batch.id,
          },
        },
        update: {
          quantity: { increment: input.quantity },
          version: { increment: 1 },
        },
        create: {
          organizationId,
          warehouseId: permission.warehouseId,
          productId: productBarcode.productId,
          batchId: batch.id,
          quantity: input.quantity,
        },
      });

      const requestId = randomUUID();
      const movement = await transaction.stockMovement.create({
        data: {
          movementNo: `RCV-${Date.now()}-${randomUUID().slice(0, 6)}`,
          organizationId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          productId: productBarcode.productId,
          batchId: batch.id,
          movementType: 'RECEIPT',
          quantityDelta: input.quantity,
          referenceType: 'STOCK_RECEIPT',
          referenceId: receipt.id,
          performedById: userId,
          idempotencyKey: requestId,
        },
      });
      await transaction.stockReceiptItem.create({
        data: {
          receiptId: receipt.id,
          productId: productBarcode.productId,
          batchId: batch.id,
          movementId: movement.id,
          barcode: input.barcode,
          quantity: input.quantity,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId,
          userId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          action: 'inventory.receive',
          entityType: 'ProductBatch',
          entityId: batch.id.toString(),
          requestId,
          afterSummary: {
            barcode: input.barcode,
            expiryDate: expiryDisplay,
            expiryPrecision,
            quantityAdded: input.quantity,
            balance: balance.quantity,
          },
        },
      });

      return {
        barcode: input.barcode,
        productId: productBarcode.productId.toString(),
        productName: input.productName,
        expiryDate: expiryDisplay,
        expiryPrecision,
        quantityAdded: input.quantity,
        currentQuantity: balance.quantity,
        receivedAt: movement.createdAt.toISOString(),
        receiptId: receipt.id.toString(),
        receiptNo: receipt.receiptNo,
        warehouseName: permission.warehouse.name,
      };
    });
  }

  async issueToShelf(
    organizationId: bigint,
    userId: bigint,
    input: ManualIssueDto,
  ) {
    const permission = await this.warehousePermission(
      organizationId,
      userId,
      'canIssue',
    );
    const batchId = BigInt(input.batchId);

    return this.prisma.client.$transaction(async (transaction) => {
      const batch = await transaction.productBatch.findFirst({
        where: { id: batchId, organizationId },
        include: { product: true },
      });
      if (!batch) {
        throw new NotFoundException('商品日期不存在');
      }
      const expiryDisplay = batch.expiryPrecision === 'MONTH'
        ? batch.expiryDate.toISOString().slice(0, 7)
        : batch.expiryDate.toISOString().slice(0, 10);

      const updated = await transaction.inventoryBalance.updateMany({
        where: {
          organizationId,
          warehouseId: permission.warehouseId,
          productId: batch.productId,
          batchId,
          quantity: { gte: input.quantity },
        },
        data: {
          quantity: { decrement: input.quantity },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('该日期库存不足');
      }

      const requestId = randomUUID();
      await transaction.stockMovement.create({
        data: {
          movementNo: `ISS-${Date.now()}-${randomUUID().slice(0, 6)}`,
          organizationId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          productId: batch.productId,
          batchId,
          movementType: 'MANUAL_ISSUE',
          quantityDelta: -input.quantity,
          referenceType: 'SHELF_REPLENISHMENT',
          reason: input.reason,
          performedById: userId,
          idempotencyKey: requestId,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId,
          userId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          action: 'inventory.issue_to_shelf',
          entityType: 'ProductBatch',
          entityId: batchId.toString(),
          requestId,
          afterSummary: {
            productName: batch.product.name,
            expiryDate: expiryDisplay,
            expiryPrecision: batch.expiryPrecision,
            quantityIssued: input.quantity,
            reason: input.reason,
          },
        },
      });
      const balance = await transaction.inventoryBalance.findUniqueOrThrow({
        where: {
          organizationId_warehouseId_productId_batchId: {
            organizationId,
            warehouseId: permission.warehouseId,
            productId: batch.productId,
            batchId,
          },
        },
      });
      return {
        productId: batch.productId.toString(),
        productName: batch.product.name,
        batchId: batchId.toString(),
        expiryDate: expiryDisplay,
        expiryPrecision: batch.expiryPrecision,
        quantityIssued: input.quantity,
        currentQuantity: balance.quantity,
        reason: input.reason,
      };
    });
  }

  async listReceipts(
    organizationId: bigint,
    userId: bigint,
    requestedDate?: string,
  ) {
    const permission = await this.warehousePermission(organizationId, userId, 'canView');
    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const date = requestedDate || this.localDate(organization.timezone);
    const receipts = await this.prisma.client.stockReceipt.findMany({
      where: {
        organizationId,
        warehouseId: permission.warehouseId,
        receiptDate: this.dateValue(date),
        status: { not: 'CANCELLED' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        openedBy: { select: { displayName: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: { select: { name: true } },
            batch: { select: { expiryDate: true, expiryPrecision: true } },
            movement: { select: { reversedBy: { select: { id: true } } } },
          },
        },
      },
    });
    const allItems = receipts.flatMap((receipt) => receipt.items);
    const effectiveItems = allItems.filter((item) => !item.movement.reversedBy);
    return {
      date,
      warehouseName: permission.warehouse.name,
      summary: {
        receiptCount: receipts.length,
        productCount: new Set(effectiveItems.map((item) => item.productId.toString())).size,
        totalQuantity: effectiveItems.reduce((sum, item) => sum + item.quantity, 0),
      },
      receipts: receipts.map((receipt) => ({
        receiptId: receipt.id.toString(),
        receiptNo: receipt.receiptNo,
        status: receipt.status,
        employeeName: receipt.openedBy.displayName,
        createdAt: receipt.createdAt.toISOString(),
        completedAt: receipt.completedAt?.toISOString() ?? null,
        productCount: new Set(receipt.items.filter((item) => !item.movement.reversedBy).map((item) => item.productId.toString())).size,
        totalQuantity: receipt.items.reduce((sum, item) => sum + (item.movement.reversedBy ? 0 : item.quantity), 0),
        items: receipt.items.map((item) => ({
          itemId: item.id.toString(),
          barcode: item.barcode,
          productName: item.product.name,
          expiryDate: item.batch.expiryPrecision === 'MONTH'
            ? item.batch.expiryDate.toISOString().slice(0, 7)
            : item.batch.expiryDate.toISOString().slice(0, 10),
          quantity: item.quantity,
          reversed: Boolean(item.movement.reversedBy),
          createdAt: item.createdAt.toISOString(),
        })),
      })),
    };
  }

  async completeCurrentReceipt(organizationId: bigint, userId: bigint) {
    const permission = await this.warehousePermission(organizationId, userId, 'canReceive');
    const receipt = await this.prisma.client.stockReceipt.findFirst({
      where: {
        organizationId,
        warehouseId: permission.warehouseId,
        openedById: userId,
        status: 'OPEN',
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    if (!receipt || receipt.items.length === 0) {
      throw new NotFoundException('当前没有可完成的入库单');
    }
    const completed = await this.prisma.client.stockReceipt.update({
      where: { id: receipt.id },
      data: { status: 'COMPLETED', completedById: userId, completedAt: new Date() },
    });
    return {
      receiptId: completed.id.toString(),
      receiptNo: completed.receiptNo,
      status: completed.status,
      totalQuantity: receipt.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async inventoryReport(organizationId: bigint, userId: bigint) {
    const permission = await this.warehousePermission(organizationId, userId, 'canView');
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
    const permission = await this.warehousePermission(organizationId, userId, 'canView');
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
    const permission = await this.warehousePermission(organizationId, userId, 'canView');
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

  async reverseMovement(
    organizationId: bigint,
    userId: bigint,
    rawMovementId: string,
    input: ReverseMovementDto,
  ) {
    if (!/^\d+$/.test(rawMovementId)) throw new BadRequestException('库存流水编号无效');
    const permission = await this.warehousePermission(organizationId, userId, 'canCount');
    await this.requireStoreAdmin(organizationId, userId, permission.warehouse.storeId);
    const movementId = BigInt(rawMovementId);

    try {
      return await this.prisma.client.$transaction(async (transaction) => {
        const repeated = await transaction.stockMovement.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: { reversalOf: { include: { product: true, batch: true } } },
        });
        if (repeated?.movementType === 'REVERSAL' && repeated.reversalOf) {
          return {
            movementId: repeated.id.toString(),
            reversedMovementId: repeated.reversalOf.id.toString(),
            reversedMovementNo: repeated.reversalOf.movementNo,
            productName: repeated.reversalOf.product.name,
            quantityDelta: repeated.quantityDelta,
            currentQuantity: null,
            repeated: true,
          };
        }

        const original = await transaction.stockMovement.findFirst({
          where: {
            id: movementId,
            organizationId,
            warehouseId: permission.warehouseId,
          },
          include: {
            product: true,
            batch: true,
            reversedBy: { select: { movementNo: true } },
          },
        });
        if (!original) throw new NotFoundException('库存流水不存在');
        if (!['RECEIPT', 'MANUAL_ISSUE'].includes(original.movementType)) {
          throw new BadRequestException('当前只允许撤销入库或手工出库流水');
        }
        if (original.reversedBy) {
          throw new ConflictException(`该流水已经由 ${original.reversedBy.movementNo} 撤销`);
        }

        const reversalDelta = -original.quantityDelta;
        const updated = await transaction.inventoryBalance.updateMany({
          where: {
            organizationId,
            warehouseId: original.warehouseId,
            productId: original.productId,
            batchId: original.batchId,
            ...(reversalDelta < 0 ? { quantity: { gte: -reversalDelta } } : {}),
          },
          data: {
            quantity: reversalDelta > 0
              ? { increment: reversalDelta }
              : { decrement: -reversalDelta },
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('当前库存不足，不能撤销这笔入库；请先核对后续出库记录');
        }

        const reversal = await transaction.stockMovement.create({
          data: {
            movementNo: `REV-${Date.now()}-${randomUUID().slice(0, 6)}`,
            organizationId,
            storeId: original.storeId,
            warehouseId: original.warehouseId,
            productId: original.productId,
            batchId: original.batchId,
            movementType: 'REVERSAL',
            quantityDelta: reversalDelta,
            referenceType: 'REVERSAL',
            referenceId: original.id,
            reason: input.reason,
            reversalOfId: original.id,
            performedById: userId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        const balance = await transaction.inventoryBalance.findUniqueOrThrow({
          where: {
            organizationId_warehouseId_productId_batchId: {
              organizationId,
              warehouseId: original.warehouseId,
              productId: original.productId,
              batchId: original.batchId,
            },
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId,
            userId,
            storeId: original.storeId,
            warehouseId: original.warehouseId,
            action: 'inventory.reverse_movement',
            entityType: 'StockMovement',
            entityId: original.id.toString(),
            requestId: input.idempotencyKey,
            beforeSummary: {
              movementNo: original.movementNo,
              movementType: original.movementType,
              quantityDelta: original.quantityDelta,
            },
            afterSummary: {
              reversalMovementNo: reversal.movementNo,
              reversalDelta,
              currentQuantity: balance.quantity,
              reason: input.reason,
            },
          },
        });
        return {
          movementId: reversal.id.toString(),
          reversedMovementId: original.id.toString(),
          reversedMovementNo: original.movementNo,
          productName: original.product.name,
          quantityDelta: reversalDelta,
          currentQuantity: balance.quantity,
          repeated: false,
        };
      });
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('该库存流水已经撤销，请刷新流水记录');
      }
      throw error;
    }
  }

  async stocktakeAdjustment(
    organizationId: bigint,
    userId: bigint,
    input: StocktakeAdjustmentDto,
  ) {
    const permission = await this.warehousePermission(organizationId, userId, 'canCount');
    const batchId = BigInt(input.batchId);
    return this.prisma.client.$transaction(async (transaction) => {
      const batch = await transaction.productBatch.findFirst({
        where: { id: batchId, organizationId },
        select: { productId: true },
      });
      if (!batch) throw new NotFoundException('商品日期不存在');
      const balance = await transaction.inventoryBalance.findUnique({
        where: {
          organizationId_warehouseId_productId_batchId: {
            organizationId,
            warehouseId: permission.warehouseId,
            productId: batch.productId,
            batchId,
          },
        },
        include: { product: true, batch: true },
      });
      if (!balance) throw new NotFoundException('该商品日期没有库存记录');
      const difference = input.actualQuantity - balance.quantity;
      if (difference === 0) throw new BadRequestException('实际数量与系统数量相同，无需调整');
      const updated = await transaction.inventoryBalance.updateMany({
        where: {
          organizationId,
          warehouseId: permission.warehouseId,
          productId: balance.productId,
          batchId,
          quantity: balance.quantity,
          version: balance.version,
        },
        data: { quantity: input.actualQuantity, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('库存刚刚发生变化，请重新查询后盘点');
      const requestId = randomUUID();
      const movement = await transaction.stockMovement.create({
        data: {
          movementNo: `STK-${Date.now()}-${randomUUID().slice(0, 6)}`,
          organizationId,
          storeId: permission.warehouse.storeId,
          warehouseId: permission.warehouseId,
          productId: balance.productId,
          batchId,
          movementType: difference > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
          quantityDelta: difference,
          referenceType: 'STOCKTAKE',
          reason: input.reason,
          performedById: userId,
          idempotencyKey: requestId,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId, userId, storeId: permission.warehouse.storeId, warehouseId: permission.warehouseId,
          action: 'inventory.stocktake_adjustment', entityType: 'StockMovement', entityId: movement.id.toString(), requestId,
          beforeSummary: { quantity: balance.quantity },
          afterSummary: { quantity: input.actualQuantity, difference, reason: input.reason },
        },
      });
      return {
        movementId: movement.id.toString(), productName: balance.product.name,
        expiryDate: balance.batch.expiryPrecision === 'MONTH' ? balance.batch.expiryDate.toISOString().slice(0, 7) : balance.batch.expiryDate.toISOString().slice(0, 10),
        previousQuantity: balance.quantity, actualQuantity: input.actualQuantity, difference,
      };
    });
  }
}
