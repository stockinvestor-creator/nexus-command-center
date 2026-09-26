import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Copy, Database, ExternalLink, KeyRound, LineChart, Rocket, Server, UserPlus } from 'lucide-react';
import { env, isSupabaseConfigured, SETUP_SEEN_KEY } from '@/lib/env';
import { Button } from '@/components/ui/Button';
import { Ambient } from '@/components/effects/Ambient';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/cn';
import { safeStorage } from '@/lib/safeStorage';

function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative mt-2 rounded-xl border border-white/10 bg-black/40">
      {label && <div className="border-b border-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</div>}
      <pre className="overflow-x-auto p-3 pr-12 font-mono text-[12px] leading-relaxed text-cyan-100">{text}</pre>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
        className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
        aria-label="Copy"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-neon-cyan hover:underline">
    {children}
    <ExternalLink className="h-3 w-3" />
  </a>
);

const STEPS = [
  {
    icon: Database,
    title: 'Create a free Supabase project',
    body: (
      <>
        <p>
          Go to <A href="https://supabase.com/dashboard">supabase.com/dashboard</A> → <b>New project</b>. Pick the <b>Free</b> plan (no credit card needed).
          Choose any region close to you and save the database password somewhere safe.
        </p>
        <p className="mt-3 text-slate-400">
          Free tier limits (500 MB database, 1 GB storage, 5 GB egress) are far above what two people use.
          Note: free projects pause after about a week of zero activity — just click <b>Restore</b> in the dashboard if that happens.
        </p>
      </>
    ),
  },
  {
    icon: Server,
    title: 'Run the supplied SQL migration',
    body: (
      <>
        <p>
          In your project open <b>SQL Editor → New query</b>, paste the entire contents of <code className="text-cyan-200">supabase/schema.sql</code> from this repo, and
          click <b>Run</b>. It creates every table, index, Row Level Security policy, the whitelist, realtime publication and the private image bucket. It is safe to run again.
        </p>
        <p className="mt-3">Then whitelist exactly your two emails (still in the SQL editor):</p>
        <CopyBlock label="SQL" text={`insert into public.allowed_emails (email) values\n  ('you@example.com'),\n  ('partner@example.com');`} />
      </>
    ),
  },
  {
    icon: UserPlus,
    title: 'Create the two accounts & lock registration',
    body: (
      <>
        <p>
          <b>Authentication → Users → Add user → Create new user</b> for each whitelisted email (tick <b>Auto Confirm User</b>). A database trigger rejects any email that is not whitelisted.
        </p>
        <p className="mt-3">
          Then <b>Authentication → Sign In / Providers</b> → turn <b>off</b> “Allow new users to sign up”. There is no sign-up screen in this app either.
        </p>
      </>
    ),
  },
  {
    icon: KeyRound,
    title: 'Copy your Supabase URL and anon key',
    body: (
      <>
        <p>
          <b>Project Settings → API</b> (or <b>Data API</b>). Copy the <b>Project URL</b> and the <b>anon / public</b> key. The anon key is designed to be public — Row Level
          Security protects the data. Never use the <code>service_role</code> key in this app.
        </p>
        <CopyBlock label=".env.local (local dev)" text={`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOi...\nVITE_MARKET_DATA_PROVIDER=tradingview`} />
      </>
    ),
  },
  {
    icon: LineChart,
    title: 'Market data: TradingView (+ optional API)',
    body: (
      <>
        <p>
          Market visuals work out of the box with official <b>TradingView</b> widgets (charts, ticker tape, movers, screener, heatmap) — set{' '}
          <code className="text-cyan-200">VITE_MARKET_DATA_PROVIDER=tradingview</code>. NEXUS never generates prices.
        </p>
        <p className="mt-3">
          Optional: for end-of-day quotes <i>inside</i> NEXUS (price alerts, trade P&amp;L) claim a free key at <A href="https://www.alphavantage.co/support/#api-key">alphavantage.co</A>, set{' '}
          <code className="text-cyan-200">VITE_MARKET_DATA_PROVIDER=alphavantage</code> and put the key in <code className="text-cyan-200">MARKET_DATA_API_KEY</code> (server-side, no <code>VITE_</code>
          prefix).
        </p>
      </>
    ),
  },
  {
    icon: Rocket,
    title: 'Add environment variables to Netlify & deploy',
    body: (
      <>
        <p>
          Push this repo to GitHub → <A href="https://app.netlify.com/start">app.netlify.com/start</A> → import it. Build settings are read from <code>netlify.toml</code>{' '}
          (build <code>npm run build</code>, publish <code>dist</code>). Under <b>Site configuration → Environment variables</b> add:
        </p>
        <CopyBlock
          label="Netlify environment variables"
          text={`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOi...\nVITE_MARKET_DATA_PROVIDER=tradingview  # or alphavantage\nMARKET_DATA_API_KEY=YOUR_FREE_KEY     # only if using alphavantage`}
        />
        <p className="mt-3">
          Trigger a deploy. Netlify's Free plan gives 300 credits/month (a production deploy costs 15, so ~20 deploys/month); if credits run out the site pauses until next month — you are never billed. Finally, in Supabase <b>Authentication → URL Configuration</b>, set the Site URL to your Netlify URL (used by password-reset emails).
        </p>
      </>
    ),
  },
];

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    safeStorage.set(SETUP_SEEN_KEY, true);
  }, []);
  const s = STEPS[step];
  const checks = [
    { ok: isSupabaseConfigured, label: 'Supabase URL + anon key detected' },
    { ok: ['tradingview', 'alphavantage'].includes(env.marketProvider), label: `Market provider: ${env.marketProvider}` },
  ];
  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <Ambient />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={40} />
          <div>
            <h1 className="font-display text-xl font-bold tracking-[0.2em] text-white">FIRST-RUN SETUP</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">$0/month · Supabase free + Netlify free</p>
          </div>
          <Link to="/login" className="ml-auto text-xs text-slate-400 hover:text-white">
            Skip →
          </Link>
        </div>

        <div className="grid flex-1 gap-4 md:grid-cols-[240px_1fr]">
          <div className="glass p-3">
            {STEPS.map((st, i) => (
              <button
                key={st.title}
                onClick={() => setStep(i)}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition', i === step ? 'bg-neon-cyan/10 text-white' : 'text-slate-400 hover:bg-white/5')}
              >
                {i < step ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className={cn('h-4 w-4 shrink-0', i === step && 'text-neon-cyan')} />}
                <span className="truncate">
                  {i + 1}. {st.title}
                </span>
              </button>
            ))}
            <div className="mt-4 space-y-1.5 border-t border-white/5 px-2 pt-3">
              <p className="label">Current build</p>
              {checks.map((c) => (
                <p key={c.label} className="flex items-center gap-2 text-xs">
                  <span className={cn('h-1.5 w-1.5 rounded-full', c.ok ? 'bg-emerald-400' : 'bg-slate-600')} />
                  <span className={c.ok ? 'text-slate-300' : 'text-slate-500'}>{c.label}</span>
                </p>
              ))}
            </div>
          </div>

          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="glass glow-border flex flex-col p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="label">Step {step + 1} of {STEPS.length}</p>
                <h2 className="font-display text-lg font-semibold text-white">{s.title}</h2>
              </div>
            </div>
            <div className="flex-1 text-sm leading-relaxed text-slate-300 [&_code]:rounded [&_code]:bg-white/5 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px]">{s.body}</div>
            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)} icon={<ChevronLeft className="h-4 w-4" />}>
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button variant="primary" onClick={() => setStep(step + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Link to="/login">
                  <Button variant="primary" icon={<Rocket className="h-4 w-4" />}>
                    {isSupabaseConfigured ? 'Go to sign in' : 'Explore in local mode'}
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
