import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PosModule } from '../pos/pos.module.js';
import { ManagementController } from './management.controller.js';
import { ManagementService } from './management.service.js';

@Module({
  imports: [AuthModule, PosModule],
  controllers: [ManagementController],
  providers: [ManagementService],
})
export class ManagementModule {}
