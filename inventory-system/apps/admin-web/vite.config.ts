import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { existsSync, readFileSync } from 'node:fs';

const certificatePath = new URL('./.cert/dev-cert.pem', import.meta.url);
const certificateKeyPath = new URL('./.cert/dev-key.pem', import.meta.url);
const hasLocalCertificate = existsSync(certificatePath) && existsSync(certificateKeyPath);

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    https: hasLocalCertificate ? {
      cert: readFileSync(certificatePath),
      key: readFileSync(certificateKeyPath),
    } : undefined,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
