import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, CircleHelp, Globe, Loader2, Search } from 'lucide-react';
import { marketData } from '@/services/market';
import { resolveSymbol, searchDirectory } from '@/services/market/symbols';
import type { ResolvedSymbol } from '@/types/market';
import { cn } from '@/lib/cn';

interface Props {
  onSelect: (r: ResolvedSymbol) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  clearOnSelect?: boolean;
  /** Render results inline (command palette / modals) instead of a floating dropdown */
  inline?: boolean;
}

interface Row extends ResolvedSymbol {
  hint?: string;
}

/**
 * Ticker search → TradingView symbol resolution.
 *  - Known tickers resolve to an exchange-qualified symbol (NASDAQ:NVDA) from the local directory.
 *  - "EXCHANGE:TICKER" typed by the user is used exactly as typed.
 *  - Unknown tickers are NEVER assigned a guessed exchange: the user picks one, or lets TradingView resolve.
 * No prices are involved in search.
 */
export function SymbolSearch({ onSelect, placeholder = 'Ticker or company (e.g. NVDA, NYSE:IBM)…', autoFocus, className, clearOnSelect = true, inline }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [remote, setRemote] = useState<Row[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const provider = marketData();

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const seen = new Set<string>();
    const push = (r: Row | null) => {
      if (r && !seen.has(r.tvSymbol)) {
        seen.add(r.tvSymbol);
        out.push(r);
      }
    };
    const typed = resolveSymbol(q);
    if (typed && q.includes(':')) push({ ...typed, hint: 'As typed' });
    for (const m of searchDirectory(q, 8)) push(resolveSymbol(m.symbol) && { ...resolveSymbol(m.symbol)!, name: m.name });
    for (const r of remote ?? []) push(r);
    if (typed && !q.includes(':') && !typed.verified) {
      push({ ...typed, hint: 'Exchange not verified — TradingView resolves it' });
      for (const ex of ['NASDAQ', 'NYSE', 'AMEX'] as const) push({ ticker: typed.ticker, exchange: ex, tvSymbol: `${ex}:${typed.ticker}`, verified: true, hint: `If ${typed.ticker} is listed on ${ex}` });
    }
    return out;
  }, [q, remote]);

  useEffect(() => {
    setRemote(null);
    setRemoteError(null);
    setIdx(0);
  }, [q]);

  useEffect(() => {
    if (inline) return;
    const onDoc = (e: MouseEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [inline]);

  const choose = (r: Row) => {
    const { hint: _h, ...rest } = r;
    void _h;
    onSelect(rest);
    if (clearOnSelect) setQ('');
    setOpen(false);
  };

  const searchRemote = async () => {
    setRemoteLoading(true);
    setRemoteError(null);
    try {
      const res = await provider.searchSymbols(q);
      setRemote(
        res
          .filter((m) => !m.region || /united states/i.test(m.region))
          .map((m): ResolvedSymbol | null => {
            const r = resolveSymbol(m.symbol);
            return r ? { ...r, name: m.name } : null;
          })
          .filter((x): x is ResolvedSymbol => x !== null),
      );
    } catch (e) {
      setRemoteError((e as Error).message);
    } finally {
      setRemoteLoading(false);
    }
  };

  const showList = (inline || open) && q.trim().length > 0;

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIdx((i) => Math.min(rows.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const pick = rows[idx];
              if (pick) choose(pick);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          className="input pl-9"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      {showList && (
        <div className={cn('overflow-hidden', inline ? 'mt-3' : 'glass-strong absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto p-1')}>
          {rows.map((r, i) => (
            <button
              key={r.tvSymbol + i}
              onMouseEnter={() => setIdx(i)}
              onClick={() => choose(r)}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition', i === idx ? 'bg-neon-cyan/10' : 'hover:bg-white/5')}
            >
              <span className="w-28 shrink-0 truncate font-mono text-sm font-semibold text-neon-cyan">{r.tvSymbol}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{r.name ?? r.hint ?? ''}</span>
              {r.verified ? (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-label="Exchange known" />
              ) : (
                <CircleHelp className="h-3.5 w-3.5 shrink-0 text-amber-400/80" aria-label="Exchange not verified" />
              )}
            </button>
          ))}
          {provider.capabilities.search && remote == null && (
            <button onClick={searchRemote} disabled={remoteLoading} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-400 transition hover:bg-white/5 hover:text-slate-200">
              {remoteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
              Search {provider.sourceLabel} for “{q}”{provider.dailyLimit ? ' (uses 1 API call, then cached)' : ''}
            </button>
          )}
          {remoteError && <p className="px-3 py-2 text-xs text-amber-400">{remoteError}</p>}
          {rows.length === 0 && <p className="px-3 py-3 text-xs text-slate-500">No matches. Type a ticker, or EXCHANGE:TICKER (e.g. NYSE:IBM).</p>}
        </div>
      )}
    </div>
  );
}
