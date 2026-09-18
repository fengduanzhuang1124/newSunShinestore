import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  allowPublicKeyRetrieval: boolean;
}

export function parseDatabaseUrl(databaseUrl: string): DatabaseConnectionConfig {
  const url = new URL(databaseUrl);

  if (url.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must use the mysql protocol');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!url.hostname || !url.username || !database) {
    throw new Error('DATABASE_URL must include host, user, and database');
  }

  const isLocalDatabase = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: 5,
    // MySQL 8 uses caching_sha2_password. The local Docker connection is not
    // TLS-enabled, so the driver must retrieve the server RSA key after a restart.
    // Never enable this automatically for a remote database; production must use TLS.
    allowPublicKeyRetrieval: isLocalDatabase,
  };
}

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return new PrismaClient({
    adapter: new PrismaMariaDb(parseDatabaseUrl(databaseUrl)),
  });
}
