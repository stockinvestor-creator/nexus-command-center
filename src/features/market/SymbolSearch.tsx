import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Loader2, Search } from 'lucide-react';
import { searchUniverse } from '@/services/market/universe';
import { marketData } from '@/services/market';
import type { SymbolMatch } from '@/types/market';
import { cn } from '@/lib/cn';
import { isValidSymbol, normalizeSymbol } from '@/lib/tickers';

interface Props {
  onSelect: (m: SymbolMatch) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  clearOnSelect?: boolean;
  /** Render results inline (for the command palette) instead of a floating dropdown */
  inline?: boolean;
}

/**
 * Ticker search. Local directory results are instant and free. For networked providers,
 * remote search is only triggered explicitly (it costs an API call).
 */
export function SymbolSearch({ onSelect, placeholder = 'Search ticker or company…', autoFocus, className, clearOnSelect = true, inline }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [remote, setRemote] = useState<SymbolMatch[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const provider = marketData();

  const local = useMemo(() => searchUniverse(q, 8), [q]);
  const typed = normalizeSymbol(q);
  const results = useMemo(() => {
    const merged = [...local];
    for (const r of remote ?? []) if (!merged.some((m) => m.symbol === r.symbol)) merged.push(r);
    if (typed && isValidSymbol(typed) && !merged.some((m) => m.symbol === typed)) {
      merged.push({ symbol: typed, name: 'Open ticker directly' });
    }
    return merged;
  }, [local, remote, typed]);

  useEffect(() => {
    setRemote(null);
    setRemoteError(null);
    setIdx(0);
    // the mock provider is free → search it automatically
    if (!provider.usesNetwork && q.trim()) {
      let alive = true;
      void provider.searchSymbols(q).then((r) => alive && setRemote(r));
      return () => {
        alive = false;
      };
    }
  }, [q, provider]);

  useEffect(() => {
    if (inline) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [inline]);

  const choose = (m: SymbolMatch) => {
    onSelect({ ...m, symbol: m.symbol.toUpperCase() });
    if (clearOnSelect) setQ('');
    setOpen(false);
  };

  const searchRemote = async () => {
    setRemoteLoading(true);
    setRemoteError(null);
    try {
      setRemote(await provider.searchSymbols(q));
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
              setIdx((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const pick = results[idx];
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
        <div
          className={cn(
            'overflow-hidden',
            inline ? 'mt-3' : 'glass-strong absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto p-1',
          )}
        >
          {results.map((m, i) => (
            <button
              key={m.symbol + i}
              onMouseEnter={() => setIdx(i)}
              onClick={() => choose(m)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                i === idx ? 'bg-neon-cyan/10' : 'hover:bg-white/5',
              )}
            >
              <span className="w-16 shrink-0 font-mono text-sm font-semibold text-neon-cyan">{m.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{m.name}</span>
              {m.exchange && <span className="font-mono text-[10px] text-slate-500">{m.exchange}</span>}
            </button>
          ))}
          {provider.usesNetwork && remote == null && (
            <button
              onClick={searchRemote}
              disabled={remoteLoading}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            >
              {remoteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
              Search {provider.name} for “{q}” (uses 1 API call, then cached)
            </button>
          )}
          {remoteError && <p className="px-3 py-2 text-xs text-amber-400">{remoteError}</p>}
          {results.length === 0 && !provider.usesNetwork && <p className="px-3 py-3 text-xs text-slate-500">No matches.</p>}
        </div>
      )}
    </div>
  );
}
