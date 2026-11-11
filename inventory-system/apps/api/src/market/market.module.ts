import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NewsController } from './news.controller.js';
import { NewsService } from './news.service.js';

// External market data for market analysis (REQ-016): industry news now; Moojing market data joins here later.
@Module({
  imports: [AuthModule],
  controllers: [NewsController],
  providers: [NewsService],
})
export class MarketModule {}
