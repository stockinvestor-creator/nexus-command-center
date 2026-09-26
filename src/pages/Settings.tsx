import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Database, FlaskConical, KeyRound, LogOut, Palette, RefreshCw, Server, Sparkles, Trash2, UserCircle2, Wifi } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Toggle } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { useAuth } from '@/store/authStore';
import { useSettings, type WidgetKey } from '@/store/settingsStore';
import { useMarketStatus } from '@/store/marketStatusStore';
import { useConnection } from '@/store/connectionStore';
import { attempt, toast } from '@/store/toastStore';
import { backend, DEMO_USERS, isDemoMode, LocalBackend } from '@/services/backend';
import { marketData, PROVIDER_OPTIONS, selectedProviderId, setProviderOverride } from '@/services/market';
import { cacheStats, clearMarketCache } from '@/services/market/requestCache';
import { invalidateMarketQueries } from '@/hooks/useMarketQuery';
import { browserNotificationsSupported, notifyUsers, requestBrowserPermission } from '@/features/notifications/api';
import { env, isSupabaseConfigured } from '@/lib/env';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { nextEodRefresh } from '@/lib/marketClock';
import type { DataFreshness } from '@/types/market';

const COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#f87171', '#e879f9'];

const WIDGETS: { key: WidgetKey; label: string; description: string }[] = [
  { key: 'tickerTape', label: 'Ticker tape', description: 'Top-of-screen tape (off = use your provider data)' },
  { key: 'marketOverview', label: 'Market overview', description: 'Indices, mega caps, macro' },
  { key: 'hotlists', label: 'Hot lists', description: 'TradingView movers' },
  { key: 'heatmap', label: 'Stock heatmap', description: 'S&P 500 by sector' },
  { key: 'economicCalendar', label: 'Economic calendar', description: 'US macro events' },
  { key: 'topStories', label: 'Top stories', description: 'TradingView news timeline' },
  { key: 'advancedChart', label: 'Advanced chart', description: 'Full TradingView chart (Markets page)' },
  { key: 'symbolInfo', label: 'Symbol info', description: 'On stock pages' },
];

const FRESHNESS_HELP: { f: DataFreshness; text: string }[] = [
  { f: 'LIVE', text: 'Real-time. Not offered by any free US-equity API we use, so the custom components never show this unless you plug in a real-time provider.' },
  { f: 'DELAYED', text: 'TradingView widgets. Depending on exchange licensing they are real-time or ~15 min delayed; we label them conservatively.' },
  { f: 'EOD', text: 'End-of-day (last close). What the Alpha Vantage free tier provides for US stocks.' },
  { f: 'DEMO', text: 'Synthetic data generated in your browser. For testing the UI only — never real prices.' },
];

function ProfileCard() {
  const profile = useAuth((s) => s.profile);
  const loadProfiles = useAuth((s) => s.loadProfiles);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [status, setStatus] = useState(profile?.status_text ?? '');
  const [color, setColor] = useState(profile?.avatar_color ?? COLORS[0]);
  const [pw, setPw] = useState('');
  useEffect(() => {
    setName(profile?.display_name ?? '');
    setStatus(profile?.status_text ?? '');
    setColor(profile?.avatar_color ?? COLORS[0]);
  }, [profile]);
  if (!profile) return null;
  return (
    <GlassCard title="Profile" icon={<UserCircle2 />}>
      <div className="flex items-center gap-4">
        <Avatar profile={{ ...profile, display_name: name || profile.display_name, avatar_color: color }} size={56} />
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{name}</p>
          <p className="truncate font-mono text-xs text-slate-500">{profile.email}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Display name" hint="Others @mention you by this (spaces removed)">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Status">
          <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. Watching the open" maxLength={80} />
        </Field>
        <Field label="Accent color" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-xl transition hover:scale-110"
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px #05060a, 0 0 0 4px ${c}, 0 0 16px ${c}` : undefined }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </Field>
      </div>
      <Button
        className="mt-4"
        variant="primary"
        onClick={async () => {
          const ok = await attempt(() => backend.update('profiles', profile.id, { display_name: name.trim() || profile.display_name, status_text: status.trim() || null, avatar_color: color }));
          if (ok) {
            await loadProfiles();
            toast.success('Profile saved');
          }
        }}
      >
        Save profile
      </Button>
      {!isDemoMode && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <Field label="Change password" hint="Minimum 8 characters">
            <div className="flex gap-2">
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              <Button
                icon={<KeyRound className="h-4 w-4" />}
                onClick={async () => {
                  if (pw.length < 8) return toast.warning('Use at least 8 characters');
                  const ok = await attempt(() => backend.updatePassword(pw).then(() => true));
                  if (ok) {
                    setPw('');
                    toast.success('Password updated');
                  }
                }}
              >
                Update
              </Button>
            </div>
          </Field>
        </div>
      )}
    </GlassCard>
  );
}

function MarketDataStatus() {
  const st = useMarketStatus();
  const provider = marketData();
  const [stats, setStats] = useState(cacheStats());
  const [choice, setChoice] = useState(selectedProviderId());
  useEffect(() => {
    const id = window.setInterval(() => setStats(cacheStats()), 5000);
    return () => window.clearInterval(id);
  }, []);
  const avMode = provider.id === 'alphavantage' ? (env.marketApiKey ? 'Direct key (dev only — key is visible in the browser)' : 'Netlify Function proxy (key stays server-side)') : null;
  const rows: [string, ReactNode][] = [
    ['Provider', <span className="flex items-center gap-2">{provider.name} <FreshnessBadge freshness={provider.freshness} /></span>],
    ['Data freshness', provider.freshness === 'DEMO' ? 'Synthetic demo data' : provider.freshness === 'EOD' ? 'End-of-day (previous close)' : provider.freshness],
    ['API calls used today', st.dailyLimit != null ? `${st.callsToday} / ${st.dailyLimit}${st.limitReached ? ' — limit reached, serving cache' : ''}` : provider.usesNetwork ? String(st.callsToday) : 'n/a (local generator, no API calls)'],
    ['Last successful update', st.lastSuccess ? `${fmtDateTime(st.lastSuccess)} (${timeAgo(st.lastSuccess)})` : provider.usesNetwork ? 'never' : 'continuous (local)'],
    ['Cache', `${stats.entries} entries · ${stats.fresh} fresh · ${(stats.bytes / 1024).toFixed(1)} KB`],
    ['Cache hits / misses', `${st.cacheHits} / ${st.cacheMisses}${st.staleServed ? ` · ${st.staleServed} served stale` : ''}`],
    ['Next EOD refresh', provider.freshness === 'EOD' ? fmtDateTime(nextEodRefresh()) : '—'],
    ['Polling', provider.refreshIntervalMs ? `every ${provider.refreshIntervalMs / 1000}s while visible (local only)` : 'no polling — refreshed only when cache expires'],
  ];
  if (avMode) rows.splice(1, 0, ['Transport', avMode]);
  return (
    <GlassCard title="Market Data Status" icon={<Server />}>
      <dl className="divide-y divide-white/[0.04] text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[150px_1fr] gap-3 py-2">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="min-w-0 break-words text-slate-200">{v}</dd>
          </div>
        ))}
      </dl>
      {st.lastError && (
        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          Last error{st.lastErrorAt ? ` (${timeAgo(st.lastErrorAt)})` : ''}: {st.lastError}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">{provider.description}</p>
      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-white/5 pt-4">
        <Field label="Provider (this browser)" className="w-56">
          <Select value={choice} onChange={setChoice} options={PROVIDER_OPTIONS.map((o) => ({ value: o.id, label: o.label }))} />
        </Field>
        <Button
          onClick={() => {
            setProviderOverride(choice === env.marketProvider ? null : choice);
            invalidateMarketQueries();
            toast.info('Provider switched', 'Reloading to apply…');
            setTimeout(() => window.location.reload(), 600);
          }}
          disabled={choice === provider.id}
        >
          Apply
        </Button>
        <Button
          variant="ghost"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => {
            clearMarketCache();
            invalidateMarketQueries();
            st.resetCounters();
            setStats(cacheStats());
            toast.info('Market cache cleared', provider.dailyLimit ? 'Next views will spend API calls again.' : undefined);
          }}
        >
          Clear cache
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-slate-600">Default comes from VITE_MARKET_DATA_PROVIDER ({env.marketProvider}). Switching here only affects this browser.</p>
    </GlassCard>
  );
}

export default function Settings() {
  const s = useSettings();
  const conn = useConnection((x) => x.status);
  const me = useAuth((x) => x.user?.id);
  const [perm, setPerm] = useState<string>(browserNotificationsSupported() ? Notification.permission : 'unsupported');

  return (
    <div>
      <PageHeader title="Settings" subtitle="Profile, data sources, effects, notifications." />
      <div className="grid gap-3 px-3 sm:px-5 xl:grid-cols-2">
        <ProfileCard />
        <MarketDataStatus />

        <GlassCard title="Data freshness labels" icon={<Database />}>
          <ul className="space-y-3">
            {FRESHNESS_HELP.map((x) => (
              <li key={x.f} className="flex gap-3">
                <FreshnessBadge freshness={x.f} className="mt-0.5 shrink-0" />
                <span className="text-xs text-slate-400">{x.text}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard title="Notifications" icon={<Bell />}>
          <p className="text-xs text-slate-400">
            In-app notifications always work. Browser notifications are optional, only appear when the tab isn&apos;t focused, and never use a paid push service.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={perm === 'granted' ? 'green' : perm === 'denied' ? 'red' : 'neutral'}>Permission: {perm}</Badge>
            {perm !== 'granted' && perm !== 'unsupported' && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const r = await requestBrowserPermission();
                  setPerm(r);
                }}
              >
                Enable browser notifications
              </Button>
            )}
          </div>
          {perm === 'granted' && (
            <Toggle checked={s.browserNotifications} onChange={(v) => s.set({ browserNotifications: v })} label="Show browser notifications" description="When the app is in the background" />
          )}
          <Button
            size="sm"
            className="mt-2"
            variant="ghost"
            onClick={() => me && void notifyUsers([me], { type: 'system', title: 'Test notification', body: 'Notifications are working ✨', link: '/settings' }, true)}
          >
            Send test notification
          </Button>
          {perm === 'denied' && <p className="mt-2 text-[11px] text-slate-500">Blocked in your browser — re-enable in site settings.</p>}
        </GlassCard>

        <GlassCard title="Visual effects" icon={<Sparkles />}>
          <Toggle checked={s.particles} onChange={(v) => s.set({ particles: v })} label="3D particle network" description="Lazy-loaded Three.js scene; pauses when the tab is hidden" />
          <Toggle checked={s.shapes} onChange={(v) => s.set({ shapes: v })} label="Floating 3D shapes" description="Subtle wireframe geometry" />
          <p className="mt-2 px-3 text-[11px] text-slate-600">Motion automatically reduces when your OS “reduce motion” setting is on.</p>
        </GlassCard>

        <GlassCard title="TradingView widgets" icon={<Palette />}>
          <p className="mb-2 px-3 text-xs text-slate-500">Free embeds. They load scripts from tradingview.com and are displayed as-is (never scraped).</p>
          {WIDGETS.map((w) => (
            <Toggle key={w.key} checked={s.widgets[w.key]} onChange={() => s.toggleWidget(w.key)} label={w.label} description={w.description} />
          ))}
        </GlassCard>

        <GlassCard title="Workspace" icon={<Wifi />}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Backend</dt>
              <dd className="text-slate-200">{isSupabaseConfigured ? 'Supabase (free tier)' : 'Demo Mode (this browser)'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Realtime</dt>
              <dd className="text-slate-200">{conn}</dd>
            </div>
            {isSupabaseConfigured && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Project</dt>
                <dd className="truncate font-mono text-xs text-slate-300">{env.supabaseUrl.replace(/^https?:\/\//, '')}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/setup">
              <Button size="sm" variant="ghost">
                Open setup guide
              </Button>
            </Link>
            <Button size="sm" variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={() => void backend.signOut()}>
              Sign out
            </Button>
          </div>
        </GlassCard>

        {isDemoMode && backend instanceof LocalBackend && (
          <GlassCard title="Demo identity" icon={<FlaskConical />}>
            <p className="text-xs text-slate-400">
              Switch who you are <b>in this tab</b>. Open a second tab as the other operator to test realtime chat, presence, typing indicators and notifications.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO_USERS.map((u) => (
                <Button key={u.id} size="sm" variant={u.id === me ? 'primary' : 'secondary'} onClick={() => (backend as LocalBackend).switchIdentity(u.id)}>
                  {u.display_name}
                </Button>
              ))}
              <ConfirmButton
                confirmLabel="Wipe demo data?"
                onConfirm={() => {
                  LocalBackend.resetDemoData();
                  window.location.reload();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Reset demo data
              </ConfirmButton>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
