import { CalendarClock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useNow } from '@/hooks/useNow';
import { currentSessionDate, etToUtcMs, isEarlyClose, isTradingDate, marketSession, nyParts, SESSION_LABEL, isoFromUtcDay } from '@/lib/marketClock';
import { MarketStatusPill } from './MarketStatus';

const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const sessionFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

function nextEvent(now: Date): { label: string; at: number } {
  const p = nyParts(now);
  const session = marketSession(now);
  const closeMin = (d: string) => (isEarlyClose(d) ? 13 * 60 : 16 * 60);
  if (session === 'open') return { label: 'Closes', at: etToUtcMs(p.date, closeMin(p.date)) };
  if (session === 'pre') return { label: 'Opens', at: etToUtcMs(p.date, 570) };
  // after-hours or closed → next trading day's open
  let t = Date.UTC(+p.date.slice(0, 4), +p.date.slice(5, 7) - 1, +p.date.slice(8, 10));
  if (!(isTradingDate(p.date) && p.minutes < 570)) t += 86400000;
  for (let i = 0; i < 10; i++, t += 86400000) {
    const d = isoFromUtcDay(t);
    if (isTradingDate(d)) return { label: 'Opens', at: etToUtcMs(d, 570) };
  }
  return { label: 'Opens', at: now.getTime() };
}

function until(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
}

/** Schedule-based market status (published NYSE hours & holidays) — not a data feed. */
export function MarketStatusPanel({ className }: { className?: string }) {
  const now = useNow(1000);
  const s = marketSession(now);
  const ev = nextEvent(now);
  const session = currentSessionDate(now);
  return (
    <GlassCard className={className} bodyClassName="p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-neon-cyan" />
          <div>
            <p className="label">Market status</p>
            <div className="mt-1">
              <MarketStatusPill />
            </div>
          </div>
        </div>
        <div>
          <p className="label">New York</p>
          <p className="num mt-0.5 text-xl text-white [text-shadow:0_0_16px_rgba(34,211,238,0.35)]">{clock.format(now)} ET</p>
        </div>
        <div>
          <p className="label">{ev.label}</p>
          <p className="mt-0.5 text-sm text-slate-200">
            {etFmt.format(new Date(ev.at))} ET <span className="font-mono text-xs text-slate-500">· in {until(ev.at - now.getTime())}</span>
          </p>
        </div>
        <div className="hidden md:block">
          <p className="label">{s === 'open' || s === 'pre' ? 'Session' : 'Last session'}</p>
          <p className="mt-0.5 text-sm text-slate-300">
            {SESSION_LABEL[s]} · {sessionFmt.format(new Date(etToUtcMs(session, 720)))}
            {isEarlyClose(session) ? ' (1:00 PM early close)' : ''}
          </p>
        </div>
        <p className="ml-auto max-w-[260px] text-[10px] leading-snug text-slate-500">Schedule-based: computed from published NYSE hours and holidays, not from a price feed.</p>
      </div>
    </GlassCard>
  );
}
