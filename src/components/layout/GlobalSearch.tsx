import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenText, FileText, MessageSquare, Newspaper, Search, Swords, Target, TrendingUp, Zap } from 'lucide-react';
import { backend } from '@/services/backend';
import { searchDirectory, resolveSymbol } from '@/services/market/symbols';
import { safeStorage } from '@/lib/safeStorage';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { IntelEvent, IntelResponse } from '@/types/intel';
import { NAV } from './nav';

interface Hit {
  id: string;
  group: string;
  icon: ReactNode;
  title: string;
  sub?: string;
  go: () => void;
}

const SEC_FORMS = ['8-K', '10-Q', '10-K', 'S-1', 'S-3', '424B5', 'DEF 14A', 'SC 13D', 'SC 13G', '20-F', '6-K', 'S-4'];

/** Events from feeds this browser has already loaded (no extra API calls). */
function cachedEvents(): IntelEvent[] {
  const out = new Map<string, IntelEvent>();
  for (const k of safeStorage.keys('ncc.intel.')) {
    const v = safeStorage.get<{ v: IntelResponse } | null>(k, null);
    for (const e of v?.v?.events ?? []) out.set(e.id, e);
  }
  return [...out.values()];
}

const like = (q: string) => `%${q.replace(/[%_]/g, '')}%`;

/** Ticker · company · SEC form · catalyst · research note · prediction · trade idea · chat · loaded news. */
export function GlobalSearch({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const go = (to: string) => () => {
    onDone();
    navigate(to);
  };

  useEffect(() => input.current?.focus(), []);

  const local = useMemo<Hit[]>(() => {
    const s = q.trim();
    if (!s) return [];
    const hits: Hit[] = [];
    for (const m of searchDirectory(s, 5)) {
      const r = resolveSymbol(m.symbol);
      hits.push({ id: `t:${m.symbol}`, group: 'Tickers', icon: <TrendingUp />, title: `${m.symbol} · ${m.name}`, sub: m.exchange ?? 'exchange unverified', go: go(`/stock/${encodeURIComponent(r?.tvSymbol ?? m.symbol)}`) });
    }
    if (/^[A-Z0-9.\-]{1,6}$/i.test(s) && !hits.some((h) => h.id === `t:${s.toUpperCase()}`)) {
      hits.push({ id: `t:${s}`, group: 'Tickers', icon: <TrendingUp />, title: `Open ${s.toUpperCase()}`, sub: 'Any US ticker (TradingView resolves the exchange)', go: go(`/stock/${s.toUpperCase()}`) });
    }
    const form = SEC_FORMS.find((f) => f.toLowerCase().replace(/\s/g, '') === s.toLowerCase().replace(/\s/g, ''));
    if (form) hits.push({ id: `f:${form}`, group: 'SEC forms', icon: <FileText />, title: `Latest ${form} filings (market-wide)`, sub: 'SEC EDGAR', go: go(`/catalysts?tab=filings&form=${encodeURIComponent(form)}`) });
    const low = s.toLowerCase();
    for (const e of cachedEvents()
      .filter((e) => e.title.toLowerCase().includes(low) || e.tickers.some((t) => t.toLowerCase() === low))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 5)) {
      hits.push({
        id: `e:${e.id}`,
        group: 'News & filings (loaded feeds)',
        icon: e.kind === 'filing' ? <FileText /> : <Newspaper />,
        title: e.title,
        sub: `${e.publisher ?? e.source} · ${timeAgo(e.at)}`,
        go: () => {
          onDone();
          window.open(e.url, '_blank', 'noopener,noreferrer');
        },
      });
    }
    for (const n of NAV.filter((n) => n.label.toLowerCase().includes(low)).slice(0, 3)) hits.push({ id: `p:${n.to}`, group: 'Pages', icon: <n.icon />, title: n.label, go: go(n.to) });
    return hits;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) {
      setRemote([]);
      return;
    }
    let alive = true;
    const t = window.setTimeout(async () => {
      setBusy(true);
      const p = like(s);
      const safe = async <T,>(f: () => Promise<T[]>) => {
        try {
          return await f();
        } catch {
          return [] as T[];
        }
      };
      const [cats, notes, preds, trades, msgs, anns] = await Promise.all([
        safe(() => backend.select('catalysts', { ilike: { column: 'headline', pattern: p }, limit: 5 })),
        safe(() => backend.select('research_notes', { ilike: { column: 'content', pattern: p }, limit: 5 })),
        safe(() => backend.select('predictions', { ilike: { column: 'title', pattern: p }, limit: 5 })),
        safe(() => backend.select('trade_ideas', { ilike: { column: 'thesis', pattern: p }, limit: 5 })),
        safe(() => backend.select('messages', { ilike: { column: 'content', pattern: p }, order: { column: 'created_at', ascending: false }, limit: 6 })),
        safe(() => backend.select('event_annotations', { ilike: { column: 'note', pattern: p }, limit: 5 })),
      ]);
      if (!alive) return;
      const snip = (t: string) => {
        const i = t.toLowerCase().indexOf(s.toLowerCase());
        return (i > 30 ? '…' : '') + t.slice(Math.max(0, i - 30), i + 90);
      };
      setRemote([
        ...cats.map((c) => ({ id: `c:${c.id}`, group: 'Catalysts', icon: <Zap />, title: `${c.symbol} · ${c.headline}`, sub: `Manual catalyst · ${c.catalyst_type}`, go: go(`/catalysts?tab=manual&focus=${c.id}`) })),
        ...notes.map((n) => ({ id: `r:${n.id}`, group: 'Research notes', icon: <BookOpenText />, title: `${n.symbol} · ${n.section}`, sub: snip(n.content), go: go(`/research/${n.symbol}`) })),
        ...anns.map((a) => ({ id: `a:${a.id}`, group: 'Research notes', icon: <BookOpenText />, title: `Note on: ${String((a.event as { title?: string }).title ?? a.event_key).slice(0, 80)}`, sub: snip(a.note ?? ''), go: go('/catalysts?tab=saved') })),
        ...preds.map((x) => ({ id: `pr:${x.id}`, group: 'Predictions', icon: <Target />, title: x.title, sub: `${x.symbol ?? 'macro'} · ${x.status.toUpperCase()}`, go: go(`/predictions?id=${x.id}`) })),
        ...trades.map((x) => ({ id: `ti:${x.id}`, group: 'Trade ideas', icon: <Swords />, title: `${x.symbol} ${x.direction}`, sub: snip(x.thesis ?? ''), go: go(`/war-room?trade=${x.id}`) })),
        ...msgs.map((m) => ({ id: `m:${m.id}`, group: 'Chat', icon: <MessageSquare />, title: snip(m.content), sub: timeAgo(m.created_at), go: go(`/messages/${m.channel_id}`) })),
      ]);
      setBusy(false);
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hits = [...local, ...remote];
  useEffect(() => setActive(0), [q]);
  let lastGroup = '';

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && hits[active]) {
              e.preventDefault();
              hits[active].go();
            }
          }}
          placeholder="Ticker, company, 8-K, catalyst, note, prediction, chat…"
          className="h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          aria-label="Search everything"
        />
        {busy && <span className="font-mono text-[10px] text-slate-500">searching…</span>}
      </div>
      {q.trim() && (
        <div className="mt-2 max-h-[55dvh] overflow-y-auto">
          {hits.length === 0 && !busy && <p className="px-2 py-4 text-center text-xs text-slate-500">No matches.</p>}
          {hits.map((h, i) => {
            const header = h.group !== lastGroup ? h.group : null;
            lastGroup = h.group;
            return (
              <div key={h.id}>
                {header && <p className="px-2 pb-1 pt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">{header}</p>}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={h.go}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left', i === active ? 'bg-neon-cyan/10' : 'hover:bg-white/[0.03]')}
                >
                  <span className="text-neon-cyan/80 [&>svg]:h-4 [&>svg]:w-4">{h.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-200">{h.title}</span>
                    {h.sub && <span className="block truncate text-[11px] text-slate-500">{h.sub}</span>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
