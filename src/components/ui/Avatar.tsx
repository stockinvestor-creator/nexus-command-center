import type { Profile } from '@/types/db';
import { cn } from '@/lib/cn';

export function Avatar({ profile, size = 32, online, className }: { profile?: Pick<Profile, 'display_name' | 'avatar_color' | 'avatar_url'> | null; size?: number; online?: boolean; className?: string }) {
  const name = profile?.display_name ?? '?';
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const color = profile?.avatar_color ?? '#64748b';
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={name} className="h-full w-full rounded-xl object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-xl font-display font-semibold text-void"
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}99)`,
            boxShadow: `0 0 16px -4px ${color}`,
            fontSize: size * 0.38,
          }}
        >
          {initials}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-void-800',
            online ? 'bg-emerald-400' : 'bg-slate-600',
          )}
        />
      )}
    </span>
  );
}
