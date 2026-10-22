import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureHttpApp } from '../src/http-app.js';

const largeRows = Array.from({ length: 200 }, (_, index) => ({ productId: String(index), productName: `商品 ${index}`, currentInventory: index }));

@Controller('sample')
class SampleController {
  @Get('large')
  large() { return { code: 200, message: '操作成功', data: largeRows }; }

  @Get('small')
  small() { return { code: 200, message: '操作成功', data: { ok: true } }; }
}

@Module({ controllers: [SampleController] })
class SampleModule {}

describe('HTTP compression (REQ-008 M7)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SampleModule] }).compile();
    app = moduleRef.createNestApplication();
    configureHttpApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('gzips large responses for clients that accept gzip without changing the body', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/sample/large')
      .set('Accept-Encoding', 'gzip')
      .expect(200);
    expect(response.headers['content-encoding']).toBe('gzip');
    expect(response.body).toEqual({ code: 200, message: '操作成功', data: largeRows });
  });

  it('leaves small responses and clients without gzip support uncompressed', async () => {
    const small = await request(app.getHttpServer()).get('/api/v1/sample/small').set('Accept-Encoding', 'gzip').expect(200);
    expect(small.headers['content-encoding']).toBeUndefined();
    const identity = await request(app.getHttpServer()).get('/api/v1/sample/large').set('Accept-Encoding', 'identity').expect(200);
    expect(identity.headers['content-encoding']).toBeUndefined();
    expect(identity.body.data).toHaveLength(200);
  });
});
