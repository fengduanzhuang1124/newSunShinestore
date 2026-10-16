import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
];
const envPath = candidates.find(existsSync);

if (envPath) {
  loadEnv({ path: envPath });
}
