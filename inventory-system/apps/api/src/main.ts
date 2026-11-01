import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';
import { configureHttpApp, DEFAULT_API_PORT, serveAdminWeb } from './http-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureHttpApp(app);
  // `start:prod` passes this flag so one port serves both the pages and the API (CR-013).
  if (process.argv.includes('--serve-admin-web')) {
    serveAdminWeb(app, fileURLToPath(new URL('../../admin-web/dist', import.meta.url)));
  }

  const port = Number(process.env.API_PORT ?? DEFAULT_API_PORT);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
