import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { existsSync, readFileSync } from 'node:fs';

const certificatePath = new URL('./.cert/dev-cert.pem', import.meta.url);
const certificateKeyPath = new URL('./.cert/dev-key.pem', import.meta.url);
const hasLocalCertificate = existsSync(certificatePath) && existsSync(certificateKeyPath);

// The management center is split into ManagementDashboard.vue and page components
// that all rely on the dashboard's scoped CSS. Giving every component under
// src/management/ the same id makes them share one style scope (static markup
// included). Other components keep the plugin's default id.
const managementComponent = /^src\/management\/.+\.vue$/;
const componentIdGenerator = (filepath: string, source: string, isProduction: boolean | undefined, getHash: (text: string) => string) =>
  managementComponent.test(filepath) ? getHash('src/management') : getHash(filepath + (isProduction ? source : ''));

// A shared id also means a shared hot-reload record, so editing one of these
// components would re-render the others with its template. Reload the page instead.
const managementFullReload: Plugin = {
  name: 'management-full-reload',
  enforce: 'pre',
  handleHotUpdate({ file, server }) {
    if (!/\/src\/management\/.+\.vue$/.test(file)) return;
    server.ws.send({ type: 'full-reload' });
    return [];
  },
};

export default defineConfig({
  plugins: [managementFullReload, vue({ features: { componentIdGenerator } })],
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
