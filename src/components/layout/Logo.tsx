import { useId } from 'react';

export function Logo({ size = 30 }: { size?: number }) {
  // unique gradient id per instance (a hidden duplicate would otherwise break the fill)
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" aria-hidden>
      <defs>
        <linearGradient id={`nx-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#0b0d14" stroke={`url(#nx-${id})`} strokeOpacity="0.5" />
      <path d="M16 46V18l16 20 16-20v28" fill="none" stroke={`url(#nx-${id})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="38" r="3.5" fill="#22d3ee" />
    </svg>
  );
}
