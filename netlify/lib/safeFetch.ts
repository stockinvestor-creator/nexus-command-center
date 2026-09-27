import { lookup } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { LookupFunction } from 'node:net';

/**
 * SSRF-hardened HTML fetch for link previews.
 *  - http/https only, default ports only, no credentials in URLs
 *  - every DNS answer must be a public unicast address (private, loopback, link-local, CGNAT,
 *    multicast, reserved, cloud-metadata and IPv6 ULA ranges are rejected)
 *  - the socket connects to the validated address (custom lookup), defeating DNS rebinding
 *  - each redirect hop is re-validated (max 3); 5 s timeout; 512 KB cap; HTML only; no JS execution
 */
export class BlockedUrlError extends Error {}

const V4_BLOCKS: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];
const v4int = (ip: string) => ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;

export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = v4int(ip);
    return V4_BLOCKS.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (v4int(base) & mask);
    });
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isBlockedIp(mapped[1]);
    if (/^f[cd]/.test(x)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(x)) return true; // fe80::/10 link-local
    if (/^ff/.test(x)) return true; // multicast
    if (x.startsWith('2001:db8') || x.startsWith('64:ff9b') || x.startsWith('100::')) return true;
    return false;
  }
  return true;
}

const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return (callback as (e: Error | null, a?: string, f?: number) => void)(err);
    const list = addresses as { address: string; family: number }[];
    if (!list.length || list.some((a) => isBlockedIp(a.address))) {
      return (callback as (e: Error | null) => void)(new BlockedUrlError(`Blocked address for ${hostname}`));
    }
    const pick = list[0];
    if ((options as { all?: boolean }).all) return (callback as (e: null, a: typeof list) => void)(null, [pick]);
    (callback as (e: null, a: string, f: number) => void)(null, pick.address, pick.family);
  });
};

export function checkUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new BlockedUrlError('Invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new BlockedUrlError('Only http(s) URLs');
  if (u.username || u.password) throw new BlockedUrlError('Credentials in URL are not allowed');
  if (u.port && !['80', '443'].includes(u.port)) throw new BlockedUrlError('Non-standard ports are not allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedIp(host)) throw new BlockedUrlError('Private address');
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw new BlockedUrlError('Internal host');
  return u;
}

export interface FetchedPage {
  finalUrl: string;
  html: string;
}

export async function safeFetchHtml(raw: string, hops = 3, timeoutMs = 5000, maxBytes = 512 * 1024): Promise<FetchedPage> {
  let current = checkUrl(raw);
  for (let i = 0; i <= hops; i++) {
    const res = await once(current, timeoutMs, maxBytes);
    if (res.redirect) {
      if (i === hops) throw new BlockedUrlError('Too many redirects');
      current = checkUrl(new URL(res.redirect, current).toString());
      continue;
    }
    return { finalUrl: current.toString(), html: res.body ?? '' };
  }
  throw new BlockedUrlError('Too many redirects');
}

function once(u: URL, timeoutMs: number, maxBytes: number): Promise<{ redirect?: string; body?: string }> {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(
      u,
      {
        method: 'GET',
        lookup: safeLookup,
        timeout: timeoutMs,
        headers: { 'User-Agent': 'NEXUS-LinkPreview/1.0 (+metadata only)', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new Error(`HTTP ${status}`));
        }
        const type = String(res.headers['content-type'] ?? '');
        if (!/text\/html|application\/xhtml/i.test(type)) {
          res.resume();
          return reject(new Error('Not an HTML page'));
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            chunks.push(c.subarray(0, Math.max(0, maxBytes - (size - c.length))));
            res.destroy();
            return;
          }
          chunks.push(c);
        });
        const done = () => resolve({ body: Buffer.concat(chunks).toString('utf8') });
        res.on('end', done);
        res.on('close', done);
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', reject);
    req.end();
  });
}

/** Extract preview metadata from HTML <head> (no script execution). */
export function parseMeta(html: string, baseUrl: string) {
  const head = html.slice(0, 200_000);
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
    const tag = re.exec(head)?.[0];
    if (!tag) return undefined;
    return /content=["']([^"']*)["']/i.exec(tag)?.[1];
  };
  const dec = (s?: string) =>
    s
      ?.replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
  const title = dec(meta('og:title') ?? meta('twitter:title') ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]);
  const description = dec(meta('og:description') ?? meta('twitter:description') ?? meta('description'));
  const siteName = dec(meta('og:site_name'));
  let image = meta('og:image') ?? meta('twitter:image');
  if (image) {
    try {
      const abs = new URL(dec(image)!, baseUrl);
      image = abs.protocol === 'https:' || abs.protocol === 'http:' ? abs.toString() : undefined;
    } catch {
      image = undefined;
    }
  }
  return { title, description, siteName, image };
}
