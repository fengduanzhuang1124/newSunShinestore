import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryPermissionService } from './inventory-permission.service.js';
import { InventoryQueryService } from './inventory-query.service.js';
import { ReceivingService } from './receiving.service.js';
import { IssuingService } from './issuing.service.js';
import { MovementService } from './movement.service.js';
import { StocktakeService } from './stocktake.service.js';

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
  ],
})
export class InventoryModule {}
