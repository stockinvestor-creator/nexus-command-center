import { ExternalLink } from 'lucide-react';
import { useLiveTable } from '@/hooks/useLiveTable';
import { resolveSymbol } from '@/services/market/symbols';
import { finvizQuote } from '@/features/market/ScreenerShortcuts';
import { cn } from '@/lib/cn';

/** Pull http(s) links the team saved in the research "links" section (IR pages etc.). */
function savedLinks(content: string | undefined): { label: string; url: string }[] {
  if (!content) return [];
  const out: { label: string; url: string }[] = [];
  for (const line of content.split(/\n/)) {
    const m = /(https?:\/\/[^\s<>"']+)/.exec(line);
    if (!m) continue;
    try {
      const u = new URL(m[1]);
      const label = line.replace(m[1], '').replace(/[-–:|]+\s*$/, '').trim() || u.hostname.replace(/^www\./, '');
      out.push({ label: label.slice(0, 40), url: u.toString() });
    } catch {
      /* ignore */
    }
  }
  return out.slice(0, 6);
}

/**
 * Research source bar: deep links to official/primary sources for a ticker. Investor-relations
 * links appear ONLY when a teammate saved them in the research page — NEXUS never guesses IR URLs.
 */
export function ResearchSourceBar({ symbol, className }: { symbol: string; className?: string }) {
  const s = symbol.toUpperCase();
  const r = resolveSymbol(s);
  const tvPath = r ? r.tvSymbol.replace(':', '-') : s;
  const notes = useLiveTable('research_notes', { eq: { symbol: s } });
  const ir = savedLinks(notes.rows.find((n) => n.section === 'links')?.content);
  const links: { label: string; url: string; hint?: string }[] = [
    { label: 'TradingView', url: `https://www.tradingview.com/symbols/${tvPath}/` },
    { label: 'SEC EDGAR', url: `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(s)}`, hint: 'Official filings' },
    { label: 'Finviz', url: finvizQuote(s) },
    { label: 'Yahoo Finance', url: `https://finance.yahoo.com/quote/${encodeURIComponent(s)}` },
    { label: 'Nasdaq', url: `https://www.nasdaq.com/market-activity/stocks/${encodeURIComponent(s.toLowerCase())}` },
    ...ir.map((l) => ({ ...l, hint: 'Saved by your team' })),
  ];
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">Sources</span>
      {links.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" title={l.hint ?? l.url} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300 transition hover:border-neon-cyan/40 hover:text-neon-cyan">
          {l.label} <ExternalLink className="h-2.5 w-2.5 opacity-60" />
        </a>
      ))}
      {!ir.length && <span className="text-[10px] text-slate-600">IR link: add it under Research → Links</span>}
    </div>
  );
}
