export class UpstreamError extends Error {
  constructor(
    public readonly source: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', ...headers },
  });
}

/** fetch with a hard timeout and consistent errors. */
export async function fetchWithTimeout(source: string, url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (res.status === 429) throw new UpstreamError(source, `${source} rate limit reached`, 429);
    if (!res.ok) throw new UpstreamError(source, `${source} returned HTTP ${res.status}`, res.status);
    return res;
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    throw new UpstreamError(source, (e as Error).name === 'AbortError' ? `${source} timed out` : `${source} unreachable`);
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T>(source: string, url: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const res = await fetchWithTimeout(source, url, init, timeoutMs);
  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError(source, `${source} returned invalid JSON`);
  }
}

export async function fetchText(source: string, url: string, init: RequestInit = {}, timeoutMs?: number): Promise<string> {
  const res = await fetchWithTimeout(source, url, init, timeoutMs);
  return res.text();
}

/** Run async tasks with limited concurrency (be polite to public APIs). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = { status: 'fulfilled', value: await fn(items[idx]) };
      } catch (reason) {
        out[idx] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const decodeEntities = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

export const stripTags = (s: string) => decodeEntities(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
