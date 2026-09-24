import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export type WarehouseCapability = 'canView' | 'canReceive' | 'canIssue' | 'canCount';

@Injectable()
export class InventoryPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async warehousePermission(
    organizationId: bigint,
    userId: bigint,
    capability: 'canView' | 'canReceive' | 'canIssue' | 'canCount',
    warehouseIdValue?: string,
  ) {
    if (warehouseIdValue && !/^\d+$/.test(warehouseIdValue)) {
      throw new BadRequestException('warehouseId必须是正整数');
    }
    const permission = await this.prisma.client.userWarehousePermission.findFirst({
      where: {
        userId,
        ...(warehouseIdValue ? { warehouseId: BigInt(warehouseIdValue) } : {}),
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

  async requireStoreAdmin(
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
}

