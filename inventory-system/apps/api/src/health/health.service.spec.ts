import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports the inventory API as healthy', () => {
    const service = new HealthService();

    expect(service.getStatus()).toEqual({
      service: 'sunshine-inventory-api',
      status: 'ok',
    });
  });
});
