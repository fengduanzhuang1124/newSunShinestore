import { INestApplication, ValidationPipe } from '@nestjs/common';
import compression from 'compression';

// Responses smaller than this are sent as-is; compressing them costs more than it saves.
const COMPRESSION_THRESHOLD_BYTES = 1024;

// HTTP behaviour shared by the running API (main.ts) and the end-to-end tests.
export function configureHttpApp(app: INestApplication): void {
  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || isLocalInventoryOrigin(origin)) callback(null, true);
      else callback(new Error('该来源无权访问库存 API'), false);
    },
  });
  // gzip for clients that ask for it (REQ-008 M7); response bodies are unchanged.
  app.use(compression({ threshold: COMPRESSION_THRESHOLD_BYTES }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
}

export function isLocalInventoryOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isPrivateIpv4 = /^10\./.test(url.hostname)
      || /^192\.168\./.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
    // The public Funnel address of whichever store machine runs the system (node on Windows since 2026-10-27);
    // only devices in this tailnet get *.tail10ff0a.ts.net names.
    const isInventoryTailscaleHost = url.protocol === 'https:'
      && url.hostname.endsWith('.tail10ff0a.ts.net')
      && (url.port === '' || url.port === '443');
    const isSupportedProtocol = url.protocol === 'http:' || url.protocol === 'https:';
    return isInventoryTailscaleHost
      || (isSupportedProtocol && url.port === '5174' && (isLocalHost || isPrivateIpv4));
  } catch {
    return false;
  }
}
