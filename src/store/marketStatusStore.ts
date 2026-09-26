import { create } from 'zustand';
import { safeStorage } from '@/lib/safeStorage';
import { nyParts } from '@/lib/marketClock';

const USAGE_KEY = 'ncc.mkt.usage';

interface Usage {
  day: string; // ET date the counter belongs to
  calls: number;
}

export interface MarketStatusState {
  providerId: string;
  providerName: string;
  status: string | null;
  dailyLimit: number | null;
  callsToday: number;
  cacheHits: number;
  cacheMisses: number;
  staleServed: number;
  lastSuccess: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  limitReached: boolean;
  init: (p: { id: string; name: string; status: string | null; dailyLimit: number | null }) => void;
  recordCall: () => void;
  recordHit: () => void;
  recordMiss: () => void;
  recordStale: () => void;
  recordSuccess: () => void;
  recordError: (msg: string, limit?: boolean) => void;
  resetCounters: () => void;
}

const readUsage = (): Usage => {
  const today = nyParts().date;
  const u = safeStorage.get<Usage>(USAGE_KEY, { day: today, calls: 0 });
  return u.day === today ? u : { day: today, calls: 0 };
};

export const useMarketStatus = create<MarketStatusState>((set, get) => ({
  providerId: 'tradingview',
  providerName: 'TradingView widgets',
  status: null,
  dailyLimit: null,
  callsToday: readUsage().calls,
  cacheHits: 0,
  cacheMisses: 0,
  staleServed: 0,
  lastSuccess: safeStorage.get<number | null>('ncc.mkt.lastSuccess', null),
  lastError: null,
  lastErrorAt: null,
  limitReached: false,
  init: (p) =>
    set({ providerId: p.id, providerName: p.name, status: p.status, dailyLimit: p.dailyLimit, callsToday: readUsage().calls }),
  recordCall: () => {
    const u = readUsage();
    u.calls += 1;
    safeStorage.set(USAGE_KEY, u);
    const limit = get().dailyLimit;
    set({ callsToday: u.calls, limitReached: limit != null && u.calls >= limit });
  },
  recordHit: () => set((s) => ({ cacheHits: s.cacheHits + 1 })),
  recordMiss: () => set((s) => ({ cacheMisses: s.cacheMisses + 1 })),
  recordStale: () => set((s) => ({ staleServed: s.staleServed + 1 })),
  recordSuccess: () => {
    const now = Date.now();
    safeStorage.set('ncc.mkt.lastSuccess', now);
    set({ lastSuccess: now });
  },
  recordError: (msg, limit = false) =>
    set((s) => ({ lastError: msg, lastErrorAt: Date.now(), limitReached: limit || s.limitReached })),
  resetCounters: () => set({ cacheHits: 0, cacheMisses: 0, staleServed: 0, lastError: null, lastErrorAt: null }),
}));

/** Read today's call count outside React */
export const callsUsedToday = () => readUsage().calls;
