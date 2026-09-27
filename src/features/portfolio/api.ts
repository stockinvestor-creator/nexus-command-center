import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import type { Patch, SimDirection, SimPosition, SimTransaction } from '@/types/db';

/**
 * SIMULATED portfolio. Nothing here touches a brokerage. Entry/exit prices are the prices YOU type
 * (or accept from a verified quote). Maths for add/reduce/close runs inside Postgres
 * (sim_apply_transaction) so average cost and realized P&L are atomic and consistent.
 */
export interface OpenPositionInput {
  symbol: string;
  direction: SimDirection;
  shares: number;
  price: number;
  entryDate: string;
  target?: number | null;
  stop?: number | null;
  thesis?: string | null;
  catalyst?: string | null;
  notes?: string | null;
  tradeIdeaId?: string | null;
}

export function openPosition(i: OpenPositionInput) {
  return backend.rpc<SimPosition>('sim_open_position', {
    p_symbol: i.symbol.toUpperCase(),
    p_direction: i.direction,
    p_shares: i.shares,
    p_price: i.price,
    p_entry_date: i.entryDate,
    p_target: i.target ?? null,
    p_stop: i.stop ?? null,
    p_thesis: i.thesis || null,
    p_catalyst: i.catalyst || null,
    p_notes: i.notes || null,
    p_trade_idea: i.tradeIdeaId || null,
  });
}

export function applyTransaction(positionId: string, type: 'add' | 'reduce' | 'close', shares: number | null, price: number, note?: string, executedAt?: string) {
  return backend.rpc<SimPosition>('sim_apply_transaction', {
    p_position: positionId,
    p_type: type,
    p_shares: shares,
    p_price: price,
    p_note: note || null,
    p_executed_at: executedAt || new Date().toISOString(),
  });
}

export function updateJournal(id: string, patch: Pick<Patch<'sim_positions'>, 'mistakes' | 'lessons' | 'result_notes' | 'screenshots' | 'notes' | 'thesis' | 'target' | 'stop' | 'catalyst'>) {
  return backend.update('sim_positions', id, patch);
}

export async function uploadScreenshot(pos: SimPosition, file: File) {
  const uid = useAuth.getState().user?.id;
  if (!uid) throw new Error('Not signed in');
  const path = await backend.uploadImage(file, uid);
  return updateJournal(pos.id, { screenshots: [...(pos.screenshots ?? []), path].slice(-8) });
}

/* ───────── maths (pure) ───────── */
export const dirSign = (d: SimDirection) => (d === 'long' ? 1 : -1);

/** Unrealized P&L using a VERIFIED current price. Returns null when no price is available. */
export function unrealized(p: SimPosition, price: number | null | undefined) {
  if (price == null || !Number.isFinite(price) || p.status !== 'open' || p.shares <= 0) return null;
  const dollars = (price - p.avg_entry) * p.shares * dirSign(p.direction);
  return { dollars, pct: ((price - p.avg_entry) / p.avg_entry) * 100 * dirSign(p.direction), marketValue: price * p.shares };
}

/** Return on a closed position (realized P&L vs. cost of the closed quantity). */
export function closedReturnPct(p: SimPosition) {
  if (p.closed_qty <= 0) return null;
  // cost basis of the closed shares = closed_value - realized (long) / closed_value + realized (short)
  const exitAvg = p.closed_value / p.closed_qty;
  const entryAvg = exitAvg - p.realized_pnl / p.closed_qty / dirSign(p.direction);
  return entryAvg > 0 ? (p.realized_pnl / (entryAvg * p.closed_qty)) * 100 : null;
}

export function holdingDays(p: SimPosition, now = Date.now()) {
  const start = Date.parse(p.entry_date || p.opened_at);
  const end = p.closed_at ? Date.parse(p.closed_at) : now;
  return Math.max(0, Math.round((end - start) / 86400_000));
}

export interface PortfolioStats {
  closedCount: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  best: SimPosition | null;
  worst: SimPosition | null;
  profitFactor: number | null;
  realizedTotal: number;
  avgHoldDays: number | null;
}

export function computeStats(positions: SimPosition[]): PortfolioStats {
  const closed = positions.filter((p) => p.status === 'closed');
  const winsL = closed.filter((p) => p.realized_pnl > 0);
  const lossL = closed.filter((p) => p.realized_pnl < 0);
  const sum = (l: SimPosition[]) => l.reduce((s, p) => s + p.realized_pnl, 0);
  const grossWin = sum(winsL);
  const grossLoss = Math.abs(sum(lossL));
  const sorted = [...closed].sort((a, b) => b.realized_pnl - a.realized_pnl);
  return {
    closedCount: closed.length,
    wins: winsL.length,
    losses: lossL.length,
    winRate: winsL.length + lossL.length ? (winsL.length / (winsL.length + lossL.length)) * 100 : null,
    avgWin: winsL.length ? grossWin / winsL.length : null,
    avgLoss: lossL.length ? -grossLoss / lossL.length : null,
    best: sorted[0] ?? null,
    worst: sorted.length ? sorted[sorted.length - 1] : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    realizedTotal: positions.reduce((s, p) => s + p.realized_pnl, 0),
    avgHoldDays: closed.length ? closed.reduce((s, p) => s + holdingDays(p), 0) / closed.length : null,
  };
}

/** Scenario calculator: P&L at a hypothetical price (USER SCENARIO, not a forecast). */
export function scenario(direction: SimDirection, shares: number, entry: number, price: number) {
  const dollars = (price - entry) * shares * dirSign(direction);
  return { dollars, pct: entry > 0 ? ((price - entry) / entry) * 100 * dirSign(direction) : 0 };
}

export const txLabel: Record<SimTransaction['type'], string> = { open: 'Open', add: 'Add', reduce: 'Reduce', close: 'Close' };
