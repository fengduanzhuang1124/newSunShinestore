import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { productBrand } from '../shared/product-brand.js';
import { AssignWarehouseLocationDto, ProductLocationQueryDto, SaveWarehouseLocationDto, SetProductLocationsDto } from './warehouse-location.dto.js';

@Injectable()
export class WarehouseLocationService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: InventoryPermissionService) {}

  async list(organizationId: bigint, userId: bigint) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const [locations, balances, homes] = await Promise.all([
      this.prisma.client.warehouseLocation.findMany({
        where: { warehouseId: permission.warehouseId, status: 'ACTIVE' },
        orderBy: [{ zone: 'asc' }, { code: 'asc' }],
        include: { placements: { where: { quantity: { gt: 0 } }, include: { product: true, batch: true } } },
      }),
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, warehouseId: permission.warehouseId, quantity: { gt: 0 } },
        select: { productId: true, batchId: true, quantity: true },
      }),
      this.prisma.client.productLocation.groupBy({
        by: ['locationId'], where: { organizationId, warehouseId: permission.warehouseId }, _count: { productId: true },
      }),
    ]);
    const homeCounts = new Map(homes.map((row) => [row.locationId.toString(), row._count.productId]));
    const assigned = new Map<string, number>();
    for (const location of locations) for (const item of location.placements) {
      const key = `${item.productId}:${item.batchId}`;
      assigned.set(key, (assigned.get(key) ?? 0) + item.quantity);
    }
    return {
      warehouseId: permission.warehouseId.toString(),
      warehouseName: permission.warehouse.name,
      canManage: true,
      unassignedTotal: balances.reduce((sum, balance) => sum + Math.max(0, balance.quantity - (assigned.get(`${balance.productId}:${balance.batchId}`) ?? 0)), 0),
      locations: locations.map((location) => ({
        locationId: location.id.toString(), code: location.code, name: location.name,
        zone: location.zone, aisle: location.aisle, shelf: location.shelf, level: location.level,
        totalQuantity: location.placements.reduce((sum, item) => sum + item.quantity, 0),
        productCount: new Set(location.placements.map((item) => item.productId.toString())).size,
        homeProductCount: homeCounts.get(location.id.toString()) ?? 0,
        placements: location.placements.map((item) => ({
          productId: item.productId.toString(), batchId: item.batchId.toString(), quantity: item.quantity,
          productName: item.product.name,
          expiryDate: item.batch.expiryPrecision === 'MONTH' ? item.batch.expiryDate.toISOString().slice(0, 7) : item.batch.expiryDate.toISOString().slice(0, 10),
        })),
      })),
    };
  }

  async create(organizationId: bigint, userId: bigint, input: SaveWarehouseLocationDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const location = await this.prisma.client.warehouseLocation.create({ data: {
      warehouseId: permission.warehouseId, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      zone: input.zone?.trim() || null, aisle: input.aisle?.trim() || null, shelf: input.shelf?.trim() || null, level: input.level?.trim() || null,
      createdById: userId, updatedById: userId,
    }});
    await this.audit(organizationId, userId, permission.warehouse.storeId, permission.warehouseId, 'CREATE_WAREHOUSE_LOCATION', location.id.toString(), null, input);
    return { locationId: location.id.toString() };
  }

  async update(organizationId: bigint, userId: bigint, locationId: string, input: SaveWarehouseLocationDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const id = BigInt(locationId);
    const before = await this.prisma.client.warehouseLocation.findFirst({ where: { id, warehouseId: permission.warehouseId } });
    if (!before) throw new NotFoundException('没有找到这个仓位');
    await this.prisma.client.warehouseLocation.update({ where: { id }, data: {
      code: input.code.trim().toUpperCase(), name: input.name.trim(), zone: input.zone?.trim() || null,
      aisle: input.aisle?.trim() || null, shelf: input.shelf?.trim() || null, level: input.level?.trim() || null, updatedById: userId,
    }});
    await this.audit(organizationId, userId, permission.warehouse.storeId, permission.warehouseId, 'UPDATE_WAREHOUSE_LOCATION', locationId, before, input);
    return { locationId };
  }

  async assign(organizationId: bigint, userId: bigint, input: AssignWarehouseLocationDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const productId = BigInt(input.productId); const batchId = BigInt(input.batchId); const locationId = BigInt(input.locationId);
    const [location, balance, placements] = await Promise.all([
      this.prisma.client.warehouseLocation.findFirst({ where: { id: locationId, warehouseId: permission.warehouseId, status: 'ACTIVE' } }),
      this.prisma.client.inventoryBalance.findUnique({ where: { organizationId_warehouseId_productId_batchId: { organizationId, warehouseId: permission.warehouseId, productId, batchId } } }),
      this.prisma.client.inventoryPlacement.findMany({ where: { organizationId, warehouseId: permission.warehouseId, productId, batchId } }),
    ]);
    if (!location) throw new NotFoundException('没有找到这个仓位');
    if (!balance) throw new NotFoundException('没有找到对应库存批次');
    const otherQuantity = placements.filter((item) => item.locationId !== locationId).reduce((sum, item) => sum + item.quantity, 0);
    if (otherQuantity + input.quantity > balance.quantity) throw new BadRequestException(`仓位分配不能超过批次库存 ${balance.quantity} 件`);
    await this.prisma.client.inventoryPlacement.upsert({
      where: { organizationId_warehouseId_locationId_productId_batchId: { organizationId, warehouseId: permission.warehouseId, locationId, productId, batchId } },
      create: { organizationId, warehouseId: permission.warehouseId, locationId, productId, batchId, quantity: input.quantity },
      update: { quantity: input.quantity },
    });
    await this.audit(organizationId, userId, permission.warehouse.storeId, permission.warehouseId, 'ASSIGN_WAREHOUSE_LOCATION', `${locationId}:${productId}:${batchId}`, placements, input);
    return { locationId: input.locationId, quantity: input.quantity };
  }

  // Products for placing (CR-008 F5): active products with their recognised brand, stock and home location. Filters:
  // brand, keyword (every word must match a name or barcode), a location (or NONE for unplaced) and in-stock only.
  private async placeableProducts(organizationId: bigint, warehouseId: bigint) {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: {
        id: true, name: true, englishName: true, chineseName: true, brandName: true,
        barcodes: { where: { status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }], select: { barcode: true } },
        inventoryBalances: { where: { warehouseId }, select: { quantity: true } },
        productLocations: { where: { warehouseId }, select: { location: { select: { id: true, code: true, name: true } } } },
      },
    });
    return products.map((product) => {
      const home = product.productLocations[0]?.location;
      return {
        productId: product.id.toString(), name: product.name, englishName: product.englishName, chineseName: product.chineseName,
        brand: productBrand(product.brandName, product.name, product.englishName, product.chineseName),
        barcodes: product.barcodes.map(({ barcode }) => barcode),
        stock: product.inventoryBalances.reduce((sum, balance) => sum + balance.quantity, 0),
        location: home ? { locationId: home.id.toString(), code: home.code, name: home.name } : null,
      };
    });
  }

  async productBrands(organizationId: bigint, userId: bigint, inStock = true) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const brands = new Map<string, { brand: string; productCount: number; placedCount: number; stock: number }>();
    for (const product of await this.placeableProducts(organizationId, permission.warehouseId)) {
      if (inStock && product.stock <= 0) continue;
      const row = brands.get(product.brand) ?? { brand: product.brand, productCount: 0, placedCount: 0, stock: 0 };
      row.productCount += 1;
      if (product.location) row.placedCount += 1;
      row.stock += Math.max(0, product.stock);
      brands.set(product.brand, row);
    }
    return [...brands.values()].sort((a, b) => b.productCount - a.productCount || a.brand.localeCompare(b.brand, 'zh-CN'));
  }

  async productsForPlacement(organizationId: bigint, userId: bigint, input: ProductLocationQueryDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const words = (input.q ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const inStock = input.inStock !== 'false';
    if (!input.brand && !words.length && !input.locationId) throw new BadRequestException('请选择品牌、仓位或输入关键词');
    const rows = (await this.placeableProducts(organizationId, permission.warehouseId)).filter((product) => {
      if (inStock && product.stock <= 0) return false;
      if (input.brand && product.brand !== input.brand) return false;
      if (input.locationId === 'NONE' ? product.location : input.locationId && product.location?.locationId !== input.locationId) return false;
      const text = [product.name, product.englishName, product.chineseName, product.brand, ...product.barcodes].filter(Boolean).join(' ').toLowerCase();
      return words.every((word) => text.includes(word));
    });
    rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    return { total: rows.length, products: rows.slice(0, 1000) };
  }

  // Sets the home location of the given products, or clears it when locationId is empty. One audit row holds every
  // product's location before and after, so a wrong bulk placement can be traced and put back.
  async setProductLocations(organizationId: bigint, userId: bigint, input: SetProductLocationsDto) {
    const permission = await this.permissions.warehousePermission(organizationId, userId, 'canView');
    const warehouseId = permission.warehouseId;
    const productIds = [...new Set(input.productIds)].map((id) => BigInt(id));
    const locationId = input.locationId ? BigInt(input.locationId) : null;
    return this.prisma.client.$transaction(async (tx) => {
      const location = locationId
        ? await tx.warehouseLocation.findFirst({ where: { id: locationId, warehouseId, status: 'ACTIVE' } })
        : null;
      if (locationId && !location) throw new NotFoundException('没有找到这个仓位');
      const products = await tx.product.findMany({ where: { id: { in: productIds }, organizationId }, select: { id: true } });
      if (products.length !== productIds.length) throw new NotFoundException('部分商品不存在，请刷新后重试');
      const before = await tx.productLocation.findMany({
        where: { organizationId, warehouseId, productId: { in: productIds } }, select: { productId: true, locationId: true },
      });
      await tx.productLocation.deleteMany({ where: { organizationId, warehouseId, productId: { in: productIds } } });
      if (locationId) {
        await tx.productLocation.createMany({
          data: productIds.map((productId) => ({ organizationId, warehouseId, productId, locationId, updatedById: userId })),
        });
      }
      const previous = new Map(before.map((row) => [row.productId.toString(), row.locationId.toString()]));
      await tx.auditLog.create({ data: {
        organizationId, userId, storeId: permission.warehouse.storeId, warehouseId, action: 'SET_PRODUCT_LOCATION',
        entityType: 'ProductLocation', entityId: location ? location.code : 'CLEAR', requestId: randomUUID(),
        beforeSummary: Object.fromEntries(productIds.map((id) => [id.toString(), previous.get(id.toString()) ?? null])),
        afterSummary: { locationId: locationId?.toString() ?? null, locationCode: location?.code ?? null, productCount: productIds.length },
      }});
      return { updated: productIds.length, location: location ? { locationId: location.id.toString(), code: location.code, name: location.name } : null };
    });
  }

  private async audit(organizationId: bigint, userId: bigint, storeId: bigint, warehouseId: bigint, action: string, entityId: string, beforeSummary: unknown, afterSummary: unknown) {
    const jsonSummary = (value: unknown) => value == null ? undefined : JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
    await this.prisma.client.auditLog.create({ data: {
      organizationId, userId, storeId, warehouseId, action, entityType: 'WarehouseLocation', entityId,
      requestId: randomUUID(), beforeSummary: jsonSummary(beforeSummary), afterSummary: jsonSummary(afterSummary),
    }});
  }
}
