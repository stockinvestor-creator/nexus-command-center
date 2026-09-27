import { useState } from 'react';
import { ExternalLink, ListChecks } from 'lucide-react';
import { WidgetPanel } from '@/components/widgets/WidgetPanel';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs } from '@/components/ui/Tabs';
import { tv } from '@/components/widgets/TradingViewWidget';

/**
 * Curated symbol lists rendered by TradingView's official quotes widget. NEXUS only chooses WHICH
 * symbols to show (labelled "NEXUS curated list"); every number in the table comes from TradingView.
 */
const CURATED: Record<string, { title: string; symbols: [string, string][] }> = {
  ai: {
    title: 'AI infrastructure & software',
    symbols: [
      ['NASDAQ:NVDA', 'NVIDIA'], ['NASDAQ:AMD', 'AMD'], ['NASDAQ:AVGO', 'Broadcom'], ['NYSE:TSM', 'TSMC'], ['NASDAQ:MU', 'Micron'],
      ['NASDAQ:MSFT', 'Microsoft'], ['NASDAQ:GOOGL', 'Alphabet'], ['NASDAQ:META', 'Meta'], ['NASDAQ:PLTR', 'Palantir'], ['NYSE:ORCL', 'Oracle'],
      ['NASDAQ:ARM', 'Arm'], ['NASDAQ:SMCI', 'Supermicro'], ['NYSE:VRT', 'Vertiv'], ['NASDAQ:ANET', 'Arista'],
    ],
  },
  semis: {
    title: 'Semiconductors',
    symbols: [
      ['NASDAQ:SOXX', 'iShares Semis ETF'], ['NASDAQ:NVDA', 'NVIDIA'], ['NASDAQ:AMD', 'AMD'], ['NASDAQ:INTC', 'Intel'], ['NASDAQ:QCOM', 'Qualcomm'],
      ['NASDAQ:AMAT', 'Applied Materials'], ['NASDAQ:LRCX', 'Lam Research'], ['NASDAQ:KLAC', 'KLA'], ['NASDAQ:ASML', 'ASML'], ['NASDAQ:MRVL', 'Marvell'],
    ],
  },
  crypto: {
    title: 'Crypto & crypto equities',
    symbols: [
      ['BITSTAMP:BTCUSD', 'Bitcoin'], ['BITSTAMP:ETHUSD', 'Ethereum'], ['COINBASE:SOLUSD', 'Solana'], ['NASDAQ:COIN', 'Coinbase'], ['NASDAQ:MSTR', 'Strategy'],
      ['NASDAQ:MARA', 'MARA Holdings'], ['NASDAQ:RIOT', 'Riot Platforms'], ['NASDAQ:HOOD', 'Robinhood'], ['AMEX:IBIT', 'iShares Bitcoin Trust'],
    ],
  },
  defense: {
    title: 'Defense & space',
    symbols: [
      ['NYSE:LMT', 'Lockheed Martin'], ['NYSE:RTX', 'RTX'], ['NYSE:NOC', 'Northrop Grumman'], ['NYSE:GD', 'General Dynamics'], ['NASDAQ:KTOS', 'Kratos'],
      ['NASDAQ:AVAV', 'AeroVironment'], ['NASDAQ:RKLB', 'Rocket Lab'], ['NASDAQ:ASTS', 'AST SpaceMobile'], ['AMEX:ITA', 'iShares Aerospace & Defense'],
    ],
  },
  biotech: {
    title: 'Biotech',
    symbols: [
      ['NASDAQ:XBI', 'SPDR Biotech ETF'], ['NASDAQ:IBB', 'iShares Biotech ETF'], ['NASDAQ:VRTX', 'Vertex'], ['NASDAQ:REGN', 'Regeneron'], ['NASDAQ:AMGN', 'Amgen'],
      ['NASDAQ:GILD', 'Gilead'], ['NASDAQ:MRNA', 'Moderna'], ['NASDAQ:BIIB', 'Biogen'], ['NASDAQ:ALNY', 'Alnylam'],
    ],
  },
};
type ListKey = keyof typeof CURATED;

export function CuratedLists({ className }: { className?: string }) {
  const [list, setList] = useState<ListKey>('ai');
  const def = CURATED[list];
  return (
    <div className={className}>
      <div className="mb-2 overflow-x-auto">
        <Tabs
          value={list}
          onChange={setList}
          options={[
            { value: 'ai', label: 'AI' },
            { value: 'semis', label: 'Semis' },
            { value: 'crypto', label: 'Crypto' },
            { value: 'defense', label: 'Defense & space' },
            { value: 'biotech', label: 'Biotech' },
          ]}
        />
      </div>
      <WidgetPanel
        key={list}
        widget="watchlistQuotes"
        title={<span>{def.title} <span className="ml-1 rounded border border-violet-400/30 px-1 text-[9px] text-violet-300">NEXUS curated list</span></span>}
        icon={<ListChecks />}
        script="market-quotes"
        config={tv.marketQuotes(def.title, def.symbols.map(([name, displayName]) => ({ name, displayName })))}
        heightClass="h-[460px]"
      />
    </div>
  );
}

/**
 * Finviz shortcuts — plain external links to finviz.com screener pages. NEXUS never fetches,
 * scrapes or embeds Finviz; the free site has no public API.
 */
const FINVIZ = 'https://finviz.com/screener.ashx?v=111';
export const FINVIZ_LINKS: { label: string; query: string }[] = [
  { label: 'Top gainers', query: 's=ta_topgainers' },
  { label: 'Top losers', query: 's=ta_toplosers' },
  { label: 'Most active', query: 's=ta_mostactive' },
  { label: 'Unusual volume', query: 's=ta_unusualvolume' },
  { label: 'New highs', query: 's=ta_newhigh' },
  { label: 'New lows', query: 's=ta_newlow' },
  { label: 'Small caps', query: 'f=cap_small' },
  { label: 'Low float (<20M)', query: 'f=sh_float_u20' },
  { label: 'Relative volume > 2', query: 'f=sh_relvol_o2' },
  { label: 'Technology', query: 'f=sec_technology' },
  { label: 'Semiconductors', query: 'f=ind_semiconductors' },
  { label: 'Biotechnology', query: 'f=ind_biotechnology' },
  { label: 'Aerospace & defense', query: 'f=ind_aerospacedefense' },
];
export const finvizQuote = (t: string) => `https://finviz.com/quote.ashx?t=${encodeURIComponent(t.toUpperCase())}`;

export function FinvizShortcuts({ className }: { className?: string }) {
  return (
    <GlassCard className={className} title="Finviz shortcuts" icon={<ExternalLink />} badge={<span className="hidden rounded border border-white/10 px-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-400 sm:inline">Opens finviz.com</span>}>
      <p className="mb-3 text-xs text-slate-500">External links only — these open Finviz in a new tab. NEXUS does not scrape or embed Finviz data.</p>
      <div className="flex flex-wrap gap-1.5">
        {FINVIZ_LINKS.map((l) => (
          <a key={l.label} href={`${FINVIZ}&${l.query}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-neon-cyan/40 hover:text-neon-cyan">
            {l.label} <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        ))}
      </div>
    </GlassCard>
  );
}
