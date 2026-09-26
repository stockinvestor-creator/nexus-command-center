/** $MU, $BRK.B, $SPY style cashtags */
export const CASHTAG_RE = /\$([A-Za-z]{1,5}(?:\.[A-Za-z]{1,2})?)\b/g;
const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;
const MENTION_RE = /@([A-Za-z0-9_.-]{2,32})/g;

export function extractTickers(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(CASHTAG_RE)) set.add(m[1].toUpperCase());
  return [...set];
}

export function extractUrls(text: string): string[] {
  return [...new Set([...text.matchAll(URL_RE)].map((m) => m[0]))];
}

export function extractMentions(text: string): string[] {
  return [...new Set([...text.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase()))];
}

export type Token =
  | { type: 'text'; value: string }
  | { type: 'ticker'; value: string }
  | { type: 'url'; value: string }
  | { type: 'mention'; value: string };

/** Splits a message into renderable tokens (never produces HTML → no XSS). */
export function tokenize(text: string): Token[] {
  const re = new RegExp(`${URL_RE.source}|${CASHTAG_RE.source}|${MENTION_RE.source}`, 'g');
  const out: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: 'text', value: text.slice(last, idx) });
    const raw = m[0];
    if (raw.startsWith('$')) out.push({ type: 'ticker', value: raw.slice(1).toUpperCase() });
    else if (raw.startsWith('@')) out.push({ type: 'mention', value: raw.slice(1) });
    else out.push({ type: 'url', value: raw });
    last = idx + raw.length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

export function normalizeSymbol(s: string): string {
  return s.trim().replace(/^\$/, '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 12);
}

export const isValidSymbol = (s: string) => /^[A-Z0-9.\-]{1,12}$/.test(s);
