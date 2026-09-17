import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || isLocalInventoryOrigin(origin)) callback(null, true);
      else callback(new Error('该来源无权访问库存 API'), false);
    },
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const port = Number(process.env.API_PORT ?? 3100);
  await app.listen(port, '0.0.0.0');
}

function isLocalInventoryOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isPrivateIpv4 = /^10\./.test(url.hostname)
      || /^192\.168\./.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
    return url.protocol === 'http:' && url.port === '5174' && (isLocalHost || isPrivateIpv4);
  } catch {
    return false;
  }
}

void bootstrap();
