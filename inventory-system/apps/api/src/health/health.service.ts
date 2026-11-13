import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getStatus() {
    return {
      service: 'sunshine-inventory-api',
      status: 'ok',
    } as const;
  }
}
