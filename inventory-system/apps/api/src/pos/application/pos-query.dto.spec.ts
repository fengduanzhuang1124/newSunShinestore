import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PosOrderQueryDto } from './pos-query.dto.js';

describe('POS query validation', () => {
  it('transforms safe pagination values', async () => {
    const query = plainToInstance(PosOrderQueryDto, {
      storeId: '12',
      page: '2',
      pageSize: '50',
      from: '2026-08-20',
      to: '2026-08-23',
      inventoryStatus: 'SIMULATED',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query).toMatchObject({ page: 2, pageSize: 50 });
  });

  it('rejects an invalid store, date, status, and oversized page', async () => {
    const query = plainToInstance(PosOrderQueryDto, {
      storeId: 'wrong',
      pageSize: '500',
      from: '20/08/2026',
      inventoryStatus: 'WRONG',
    });

    expect(await validate(query)).toHaveLength(4);
  });
});
