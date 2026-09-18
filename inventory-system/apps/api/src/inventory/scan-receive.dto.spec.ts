import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScanReceiveDto } from './scan-receive.dto.js';

describe('ScanReceiveDto', () => {
  const validInput = {
    warehouseId: '7',
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    barcode: '9421907983356',
    productName: '测试商品',
    expiryMonth: '2027-11',
    quantity: 2,
  };

  it('accepts an explicit warehouse and a stable request id', async () => {
    await expect(validate(plainToInstance(ScanReceiveDto, validInput))).resolves.toHaveLength(0);
  });

  it('rejects an入库 request without warehouse and idempotency identifiers', async () => {
    const { warehouseId: _warehouseId, idempotencyKey: _idempotencyKey, ...missingIdentifiers } = validInput;
    const errors = await validate(plainToInstance(ScanReceiveDto, missingIdentifiers));
    expect(errors.map(({ property }) => property)).toEqual(expect.arrayContaining(['warehouseId', 'idempotencyKey']));
  });
});
