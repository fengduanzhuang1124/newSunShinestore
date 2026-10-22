// Local-only preview of the management center with fixed sample data.
// Served by the Vite dev server at /preview/management.html; it is not part of
// the production build (vite build only bundles index.html).
// Query parameters: theme=dark|light, state=ready|loading|error|forbidden.
import { createApp } from 'vue';
import App from '../src/App.vue';
import '../src/styles.css';
import { managementFixtures } from './management-fixtures';

const params = new URLSearchParams(location.search);
const state = params.get('state') ?? 'ready';

localStorage.setItem('sunshine_inventory_access_token', 'preview-token');
localStorage.setItem('sunshine_inventory_profile', JSON.stringify({
  id: 'preview', displayName: '预览管理员', mustChangePassword: false,
  roles: [{ code: 'ADMIN', storeId: '1', storeName: '汉密尔顿 City 店' }],
  warehouses: [{ warehouseId: '1', canReceive: true }],
}));
localStorage.setItem('sunshine_inventory_mode', 'management');
localStorage.setItem('sunshine_management_theme', params.get('theme') === 'light' ? 'light' : 'dark');

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

window.fetch = async (input) => {
  const url = new URL(String(input instanceof Request ? input.url : input), location.origin);
  const path = url.pathname.split('/management/')[1];
  if (!path) return json(404, { message: `预览未提供 ${url.pathname}` });
  if (state === 'loading' && path !== 'access') return new Promise<Response>(() => undefined);
  if (state === 'error' && path !== 'access') return json(500, { message: '经营 API 暂时不可用' });
  if (state === 'forbidden' && path !== 'access') return json(403, { message: '当前账号无权限查看' });
  const data = managementFixtures[path];
  if (data === undefined) {
    console.warn(`[preview] no fixture for ${path}`);
    return json(404, { message: `预览未提供 ${path}` });
  }
  return json(200, { data });
};

createApp(App).mount('#app');
