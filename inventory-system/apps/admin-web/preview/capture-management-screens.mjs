// Captures the management preview at phone sizes and measures layout problems
// (REQ-008 acceptance A1-A3). Requires the admin-web dev server and Google Chrome.
//
//   node preview/capture-management-screens.mjs --base https://127.0.0.1:5180 --out ../../outputs/req-008/before
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, list) => (value.startsWith('--') ? [...pairs, [value.slice(2), list[index + 1]]] : pairs), []));
const base = args.base ?? 'https://127.0.0.1:5180';
const outDir = resolve(args.out ?? 'screens');
const chromePath = args.chrome ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const viewports = [{ name: '375x667', width: 375, height: 667 }, { name: '390x844', width: 390, height: 844 }, { name: '430x932', width: 430, height: 932 }];
const sections = [
  ['overview', '经营总览'], ['sales', '销售分析'], ['products', '商品分析'], ['inventory', '库存经营'],
  ['procurement', '本周进货'], ['customers', '分类与标签'], ['stores', '门店对比'], ['system', '数据中心'],
];

class Cdp {
  constructor(url) { this.socket = new WebSocket(url); this.id = 0; this.pending = new Map(); this.waiters = []; }
  async open() {
    await new Promise((done, fail) => { this.socket.onopen = done; this.socket.onerror = fail; });
    this.socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id && this.pending.has(message.id)) {
        const { done, fail } = this.pending.get(message.id); this.pending.delete(message.id);
        message.error ? fail(new Error(message.error.message)) : done(message.result);
      } else if (message.method) this.waiters = this.waiters.filter((waiter) => !(waiter.method === message.method && (waiter.done(message.params), true)));
    };
  }
  send(method, params = {}) { const id = ++this.id; this.socket.send(JSON.stringify({ id, method, params })); return new Promise((done, fail) => this.pending.set(id, { done, fail })); }
  once(method) { return new Promise((done) => this.waiters.push({ method, done })); }
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }
}

// Runs inside the page: scroll every scroll container to the top or bottom.
const scrollAll = (where) => `(() => {
  const nodes = [document.scrollingElement, ...document.querySelectorAll('*')].filter((node) => node && node.scrollHeight > node.clientHeight + 1 && getComputedStyle(node).overflowY !== 'visible' && getComputedStyle(node).overflowY !== 'hidden' || node === document.scrollingElement);
  for (const node of nodes) node.scrollTop = ${where === 'bottom' ? 'node.scrollHeight' : '0'};
})()`;

// Runs inside the page: layout measurements recorded in the baseline report.
const measure = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const overflowing = [...document.querySelectorAll('.management-workspace *')].filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && !el.closest('[class*="scroll"], table, .table-wrap'))
    .map((el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : el.tagName.toLowerCase()));
  const nav = document.querySelector('.management-mobile-nav');
  const navRect = nav && visible(nav) ? nav.getBoundingClientRect() : null;
  const scrollers = [...document.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY))
    .map((el) => (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/)[0] : el.tagName.toLowerCase()));
  const small = [...document.querySelectorAll('.management-workspace button, .management-workspace a, .management-workspace select, .management-workspace input')]
    .filter((el) => visible(el) && (() => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44; })()).length;
  const tables = [...document.querySelectorAll('.management-workspace table')].filter(visible).length;
  const inputs = [...document.querySelectorAll('.management-workspace input, .management-workspace select')].filter((el) => visible(el) && parseFloat(getComputedStyle(el).fontSize) < 16).length;
  return {
    viewport: [vw, vh], documentScrollWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > vw,
    overflowingElements: [...new Set(overflowing)].slice(0, 12), documentScrollHeight: document.documentElement.scrollHeight,
    nestedScrollContainers: [...new Set(scrollers)], mobileNav: navRect ? { top: Math.round(navRect.top), bottomGap: Math.round(vh - navRect.bottom), height: Math.round(navRect.height) } : null,
    controlsUnder44px: small, visibleTables: tables, inputsUnder16px: inputs,
  };
})()`;

// Runs inside the page: rendered DOM with the build-specific style scope hash removed,
// used to prove a refactor renders identical markup.
const domSnapshot = `document.body.innerHTML.replace(/data-v-[0-9a-f]{8}/g, 'data-v').replace(/></g, '>\\n<')`;

async function main() {
  await mkdir(join(outDir, 'dom'), { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), 'req008-chrome-'));
  const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--ignore-certificate-errors', '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const browserUrl = await new Promise((done, fail) => {
    let text = ''; chrome.stderr.on('data', (chunk) => { text += chunk; const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) done(match[1]); });
    chrome.on('exit', () => fail(new Error(`Chrome exited: ${text}`)));
  });
  const port = new URL(browserUrl).port;
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const page = new Cdp(target.webSocketDebuggerUrl); await page.open();
  await page.send('Page.enable'); await page.send('Runtime.enable');
  const warnings = [];
  const report = { capturedAt: new Date().toISOString(), base, pages: [] };

  const shot = async (file) => {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(outDir, file), Buffer.from(data, 'base64'));
  };
  const load = async (query) => {
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url: `${base}/preview/management.html?${query}` });
    await loaded; await sleep(1200);
  };
  const select = async (label) => {
    const found = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.management-sidebar button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)})); b?.click(); return Boolean(b); })()`);
    if (!found) warnings.push(`section button not found: ${label}`);
    await sleep(900);
  };

  for (const theme of ['dark', 'light']) {
    for (const viewport of viewports) {
      if (theme === 'light' && viewport.name !== '390x844') continue;
      await page.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 2, mobile: true });
      await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
      await load(`theme=${theme}`);
      for (const [id, label] of sections) {
        await select(label);
        await page.evaluate(scrollAll('top')); await sleep(200);
        const prefix = `${viewport.name}-${theme}-${id}`;
        const metrics = await page.evaluate(measure);
        await writeFile(join(outDir, 'dom', `${prefix}.html`), await page.evaluate(domSnapshot));
        await shot(`${prefix}-top.png`);
        await page.evaluate(scrollAll('bottom')); await sleep(300);
        await shot(`${prefix}-bottom.png`);
        report.pages.push({ viewport: viewport.name, theme, section: id, label, ...metrics });
      }
      await select('经营总览');
      await page.evaluate(`document.querySelector('.management-mobile-nav button:last-child')?.click()`); await sleep(500);
      await shot(`${viewport.name}-${theme}-more-sheet.png`);
    }
  }

  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  for (const state of ['loading', 'error', 'forbidden']) {
    await load(`theme=dark&state=${state}`);
    await shot(`390x844-dark-state-${state}.png`);
  }
  await page.send('Emulation.clearDeviceMetricsOverride');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await load('theme=dark');
  for (const [id, label] of sections) { await select(label); await page.evaluate(scrollAll('top')); await shot(`1440x900-dark-${id}.png`); }

  report.warnings = warnings;
  await writeFile(join(outDir, 'layout-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const exited = new Promise((done) => chrome.once('exit', done));
  chrome.kill(); await exited;
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  console.log(`Saved ${report.pages.length} page measurements to ${outDir}`);
  if (warnings.length) console.warn(warnings.join('\n'));
}

main().catch((error) => { console.error(error); process.exit(1); });
