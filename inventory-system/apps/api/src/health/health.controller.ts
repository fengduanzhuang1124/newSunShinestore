import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return {
      code: 200,
      message: 'Inventory API is healthy',
      data: this.healthService.getStatus(),
    };
  }
}
