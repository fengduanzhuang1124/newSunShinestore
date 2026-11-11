import './config/environment.js';
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { PosModule } from './pos/pos.module.js';
import { ManagementModule } from './management/management.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { MarketModule } from './market/market.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, InventoryModule, PosModule, ManagementModule, AssistantModule, MarketModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
