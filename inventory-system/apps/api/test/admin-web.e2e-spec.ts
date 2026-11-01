import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { configureHttpApp, serveAdminWeb } from '../src/http-app.js';

@Module({})
class EmptyModule {}

describe('Built admin pages served by the API (CR-013)', () => {
  let app: NestExpressApplication;
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'admin-web-'));
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><div id="app"></div>');
    writeFileSync(join(root, 'assets', 'index-abc123.js'), 'console.log("bundle");'.repeat(200));
    writeFileSync(join(root, 'logo.webp'), 'image');

    const moduleRef = await Test.createTestingModule({ imports: [EmptyModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(app);
    serveAdminWeb(app, root);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('serves index.html at the root and asks the browser to revalidate it', async () => {
    const response = await request(app.getHttpServer()).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<div id="app">');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('caches hashed bundles for a year and compresses them', async () => {
    const response = await request(app.getHttpServer()).get('/assets/index-abc123.js').set('Accept-Encoding', 'gzip');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers['content-encoding']).toBe('gzip');
  });

  it('caches other public files for a day and leaves the API prefix to the API', async () => {
    const image = await request(app.getHttpServer()).get('/logo.webp');
    const api = await request(app.getHttpServer()).get('/api/v1/unknown');

    expect(image.headers['cache-control']).toBe('public, max-age=86400');
    expect(api.status).toBe(404);
    expect(api.headers['cache-control']).toBeUndefined();
  });
});
