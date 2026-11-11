import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request } from 'node:https';
import type { IncomingMessage } from 'node:http';
import { isIP, type LookupFunction } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { isPublicAddress } from './news-feed.js';

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// A reason that is safe to show to administrators and store in news_sources.last_error.
export class FeedFetchError extends Error {}

// Resolves the host and refuses internal addresses. The connection uses the checked address, so a second DNS answer
// cannot point the request somewhere else.
const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '', 4);
    const blocked = addresses.find((address) => !isPublicAddress(address.address));
    if (!addresses.length || blocked) return callback(new FeedFetchError('地址指向内部网络，已拒绝'), '', 4);
    if (options.all) return (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

function decoded(response: IncomingMessage) {
  const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
  if (encoding === 'gzip') return response.pipe(createGunzip());
  if (encoding === 'deflate') return response.pipe(createInflate());
  if (encoding === 'br') return response.pipe(createBrotliDecompress());
  return response;
}

function getOnce(url: URL): Promise<{ redirect: string } | { body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'GET', lookup: publicLookup, timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'SunshineInventory/1.0 (industry news reader)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5', 'Accept-Encoding': 'gzip, deflate, br' },
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        return resolve({ redirect: response.headers.location });
      }
      if (status !== 200) {
        response.resume();
        return reject(new FeedFetchError(`网站返回 HTTP ${status}`));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      const stream = decoded(response);
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          req.destroy();
          reject(new FeedFetchError('内容超过 3 MB'));
          return;
        }
        chunks.push(chunk);
      });
      stream.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8') }));
      stream.on('error', () => reject(new FeedFetchError('内容解压失败')));
    });
    req.on('timeout', () => req.destroy(new FeedFetchError('连接超时')));
    req.on('error', (error) => reject(error instanceof FeedFetchError ? error : new FeedFetchError(`连接失败（${(error as NodeJS.ErrnoException).code ?? '网络错误'}）`)));
    req.end();
  });
}

// Reads a feed over https only, following at most three redirects (each to https).
export async function fetchFeedText(address: string) {
  let url = new URL(address);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (url.protocol !== 'https:') throw new FeedFetchError('只支持 https 地址');
    // An address written as an IP is connected to without a DNS lookup, so it is checked here.
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && !isPublicAddress(host)) throw new FeedFetchError('地址指向内部网络，已拒绝');
    const result = await getOnce(url);
    if ('body' in result) return result.body;
    url = new URL(result.redirect, url);
  }
  throw new FeedFetchError('跳转次数过多');
}
