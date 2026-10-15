import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { InventoryQueryService } from './inventory-query.service.js';
import { ReceivingService } from './receiving.service.js';
import { IssuingService } from './issuing.service.js';
import { MovementService } from './movement.service.js';
import { StocktakeService } from './stocktake.service.js';
import { InventoryMaintenanceService } from './inventory-maintenance.service.js';
import { WarehouseLocationService } from './warehouse-location.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InventoryController],
  providers: [
    InventoryPermissionService,
    InventoryQueryService,
    ReceivingService,
    IssuingService,
    MovementService,
    StocktakeService,
    InventoryMaintenanceService,
    WarehouseLocationService,
  ],
})
export class InventoryModule {}
