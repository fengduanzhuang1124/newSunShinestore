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
import { parseExpiryInput } from './expiry-date.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async warehousePermission(
    organizationId: bigint,
    userId: bigint,
    capability: 'canView' | 'canReceive' | 'canIssue',
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
          referenceType: 'BARCODE_RECEIPT',
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
}
