import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
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

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: 5,
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
