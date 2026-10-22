import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureHttpApp } from './http-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureHttpApp(app);

  const port = Number(process.env.API_PORT ?? 3100);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
