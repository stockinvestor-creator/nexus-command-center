import { useEffect, useRef } from 'react';
import { useAuth } from '@/store/authStore';
import { useMyTickers } from '@/features/intel/useMyTickers';
import { useNews, useSecFilings } from '@/hooks/useIntel';
import { safeStorage } from '@/lib/safeStorage';
import { toast } from '@/store/toastStore';
import type { IntelEvent } from '@/types/intel';
import { showBrowserNotification } from './api';
import { useNotificationPrefs } from './prefs';

const ALERT_FORMS = /^(8-K|S-1|S-3|F-1|F-3|424B\d|DEF 14A|DEFM14A|SC 13D|SCHEDULE 13D|SC TO-T|10-Q|10-K)/;
const ALERT_NEWS = new Set(['MANAGEMENT', 'OFFERING', 'FINANCING', 'FDA', 'LEGAL_REGULATORY', 'EARNINGS', 'M_AND_A', 'CYBER', 'RESTRUCTURING']);
const MAX_AGE = 48 * 3600_000;

/**
 * Watchlist alerts. Reuses the SAME shared SEC / news queries as Catalyst Intelligence, the Briefing
 * and Why-Is-It-Moving (one request per key app-wide). New items → in-app toast + optional browser
 * notification. The first run for a user only records what exists (no alert flood).
 */
export function useWatchlistAlerts() {
  const uid = useAuth((s) => s.user?.id);
  const { prefs, loading: prefsLoading } = useNotificationPrefs();
  const { tickers } = useMyTickers();
  const wantSec = prefs.sec_filing;
  const wantNews = prefs.watchlist_catalyst;
  const sec = useSecFilings(wantSec ? tickers : []);
  const news = useNews(wantNews ? tickers : []);
  const key = `ncc.alerts.seen.${uid ?? 'anon'}`;
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!uid || prefsLoading) return;
    if (!seenRef.current) seenRef.current = new Set(safeStorage.get<string[]>(key, []));
    const seen = seenRef.current;
    const firstRun = !safeStorage.get<boolean>(`${key}.init`, false);
    const fresh: { e: IntelEvent; kind: 'sec' | 'news' }[] = [];
    const consider = (list: IntelEvent[] | undefined, kind: 'sec' | 'news') => {
      for (const e of list ?? []) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        if (Date.now() - Date.parse(e.at) > MAX_AGE + (e.atPrecision === 'date' ? 86400_000 : 0)) continue;
        if (kind === 'sec' && !(e.form && ALERT_FORMS.test(e.form))) continue;
        if (kind === 'news' && !e.classifications.some((c) => ALERT_NEWS.has(c.category))) continue;
        fresh.push({ e, kind });
      }
    };
    if (wantSec) consider(sec.data?.data.events, 'sec');
    if (wantNews) consider(news.data?.data.events, 'news');
    safeStorage.set(key, [...seen].slice(-800));
    if (sec.data || news.data) safeStorage.set(`${key}.init`, true);
    if (firstRun) return;
    for (const { e, kind } of fresh.slice(0, 5)) {
      const t = e.tickers[0] ?? e.company ?? '';
      const cat = e.classifications.find((c) => c.category !== 'NEWS' && c.category !== 'UNCLASSIFIED');
      const title = kind === 'sec' ? `New ${e.form}: ${t}${cat ? ` — ${cat.label}` : ''}` : `${t}: ${cat?.label ?? 'Catalyst'} (news)`;
      const body = `${e.title.slice(0, 140)} · SOURCE: ${e.publisher ?? e.source}`;
      const link = `/catalysts?tab=${kind === 'sec' ? 'filings' : 'news'}${e.tickers[0] ? `&ticker=${e.tickers[0]}` : ''}`;
      toast.info(title, body, link);
      showBrowserNotification(title, body, link);
    }
    if (fresh.length > 5) toast.info(`${fresh.length - 5} more watchlist alerts`, undefined, '/catalysts');
  }, [uid, prefsLoading, key, wantSec, wantNews, sec.data, news.data]);
}
