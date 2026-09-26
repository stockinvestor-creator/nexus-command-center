import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, FlaskConical, Lock, Mail, ShieldCheck } from 'lucide-react';
import { backend, DEMO_USERS, isDemoMode } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Ambient } from '@/components/effects/Ambient';
import { Logo } from '@/components/layout/Logo';

export default function LoginPage() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await backend.signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    setError(null);
    if (!email) return setError('Enter your email first.');
    try {
      await backend.sendPasswordReset(email);
      setInfo('If that account exists, a reset link is on its way.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <Ambient />
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="glass-strong glow-border w-full max-w-md p-7 sm:p-9"
        >
          <div className="mb-7 flex flex-col items-center text-center">
            <Logo size={56} />
            <h1 className="mt-4 font-display text-2xl font-bold tracking-[0.3em] text-white">NEXUS</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Private Command Center</p>
          </div>

          {isDemoMode ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 p-3 text-xs text-fuchsia-100">
                <p className="flex items-center gap-2 font-semibold">
                  <FlaskConical className="h-4 w-4" /> Demo Mode
                </p>
                <p className="mt-1 text-fuchsia-200/80">
                  Supabase isn&apos;t configured yet, so data is stored in this browser only. Open two tabs as different operators to test realtime chat.
                </p>
              </div>
              {DEMO_USERS.map((u) => (
                <Button
                  key={u.id}
                  variant={u.id === DEMO_USERS[0].id ? 'primary' : 'secondary'}
                  className="w-full"
                  icon={<ArrowRight className="h-4 w-4" />}
                  onClick={async () => {
                    await backend.signIn(u.email, '');
                    navigate(from, { replace: true });
                  }}
                >
                  Enter as {u.display_name}
                </Button>
              ))}
              <Link to="/setup" className="block text-center text-xs text-neon-cyan hover:underline">
                Set up Supabase for the real two-person workspace →
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
              {error && <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
              {info && <p className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">{info}</p>}
              <Button type="submit" variant="primary" className="w-full" loading={loading} icon={<ShieldCheck className="h-4 w-4" />}>
                Authenticate
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={reset} className="text-slate-500 hover:text-slate-300">
                  Forgot password?
                </button>
                <Link to="/setup" className="text-slate-500 hover:text-slate-300">
                  Setup guide
                </Link>
              </div>
              <p className="pt-2 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-slate-600">
                Invite-only · registration is closed
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
