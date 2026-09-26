import { useEffect, useRef } from 'react';
import { useAuth } from '@/store/authStore';
import { useLiveTable } from '@/hooks/useLiveTable';
import { backend } from '@/services/backend';
import { marketData } from '@/services/market';
import { notifyUsers } from '@/features/notifications/api';
import { fmtPrice } from '@/lib/format';

/**
 * Client-side price alerts: checks active alerts against the latest AVAILABLE quote.
 * Uses the provider cache (EOD providers therefore trigger at most once per trading day).
 */
export function usePriceAlertWatcher() {
  const uid = useAuth((s) => s.user?.id);
  const alerts = useLiveTable(uid ? 'price_alerts' : null, { eq: { user_id: uid ?? '', active: true } });
  const rowsRef = useRef(alerts.rows);
  rowsRef.current = alerts.rows;

  useEffect(() => {
    if (!uid) return;
    const provider = marketData();
    const interval = provider.refreshIntervalMs ? Math.max(provider.refreshIntervalMs, 30_000) : 15 * 60_000;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const symbols = [...new Set(rowsRef.current.map((a) => a.symbol))];
        for (const sym of symbols) {
          let price: number;
          try {
            price = (await provider.getQuote(sym)).price;
          } catch {
            continue;
          }
          for (const a of rowsRef.current.filter((x) => x.symbol === sym)) {
            const hit = a.condition === 'above' ? price >= a.price : price <= a.price;
            if (!hit) continue;
            await backend.update('price_alerts', a.id, { active: false, triggered_at: new Date().toISOString() });
            await notifyUsers(
              [uid],
              {
                type: 'price_alert',
                title: `$${sym} is ${a.condition} ${fmtPrice(a.price)}`,
                body: `Latest available price: ${fmtPrice(price)} (${provider.freshness})`,
                link: `/stock/${sym}`,
              },
              true,
            );
          }
        }
      } finally {
        busy = false;
      }
    };
    const first = window.setTimeout(check, 4000);
    const id = window.setInterval(check, interval);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [uid]);
}
