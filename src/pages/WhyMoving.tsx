import { useNavigate, useSearchParams } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { WhyPanel } from '@/features/why/WhyPanel';
import { isValidSymbol, normalizeSymbol } from '@/lib/tickers';
import type { WhyWindow } from '@/features/why/evidence';
import { useMyTickers } from '@/features/intel/useMyTickers';

export default function WhyMoving() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const symbol = normalizeSymbol(params.get('symbol') ?? '');
  const valid = isValidSymbol(symbol);
  const { tickers } = useMyTickers();
  return (
    <div>
      <PageHeader title="Why is it moving?" subtitle="Sourced evidence only — confirmed filings, tagged news, dated catalysts. No invented narratives." />
      <div className="space-y-3 px-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <SymbolSearch className="w-full max-w-sm" placeholder="Ticker…" onSelect={(s) => navigate(`/why?symbol=${s.ticker}`)} />
          {tickers.slice(0, 10).map((t) => (
            <button key={t} onClick={() => navigate(`/why?symbol=${t}`)} className={`rounded-md border px-2 py-1 font-mono text-[11px] ${t === symbol ? 'border-neon-cyan/50 text-neon-cyan' : 'border-white/10 text-slate-400 hover:text-slate-200'}`}>
              {t}
            </button>
          ))}
        </div>
        <GlassCard title={valid ? `Why is ${symbol} moving?` : 'Pick a ticker'} icon={<HelpCircle />}>
          {valid ? <WhyPanel key={symbol} symbol={symbol} initialWindow={(params.get('window') as WhyWindow) ?? 'today'} /> : <p className="text-sm text-slate-500">Search a ticker or pick one from your watchlist.</p>}
        </GlassCard>
      </div>
    </div>
  );
}
