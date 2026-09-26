import { lazy, Suspense } from 'react';
import { useSettings } from '@/store/settingsStore';

const ParticleBackground = lazy(() => import('./ParticleBackground'));

function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
const webgl = typeof document !== 'undefined' && supportsWebGL();

/** Ambient layers: CSS gradient orbs + noise (always, cheap) and the lazy Three.js scene (optional). */
export function Ambient() {
  const particles = useSettings((s) => s.particles);
  const shapes = useSettings((s) => s.shapes);
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <div className="grid-lines absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[480px] w-[480px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-200px] left-1/3 h-[420px] w-[420px] rounded-full bg-blue-600/10 blur-[120px]" />
        {/* orbital ring */}
        <div className="absolute right-[-180px] top-[-180px] hidden h-[520px] w-[520px] animate-orbit rounded-full border border-cyan-400/[0.07] lg:block">
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_2px_rgba(34,211,238,0.8)]" />
        </div>
      </div>
      {particles && webgl && (
        <Suspense fallback={null}>
          <ParticleBackground shapes={shapes} />
        </Suspense>
      )}
      <div className="noise-overlay" aria-hidden />
    </>
  );
}
