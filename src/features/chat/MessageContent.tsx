import { memo } from 'react';
import { tokenize } from '@/lib/tickers';
import { TickerChip } from '@/components/ui/TickerChip';
import { useAuth } from '@/store/authStore';
import { handleFor } from './api';

/** Renders message text safely (no HTML), turning $TICKERs into chips, URLs into links, @mentions into pills. */
function MessageContentInner({ text, className }: { text: string; className?: string }) {
  const profiles = useAuth((s) => s.profiles);
  const me = useAuth((s) => s.user?.id);
  const tokens = tokenize(text);
  return (
    <span className={className}>
      {tokens.map((t, i) => {
        if (t.type === 'ticker') return <TickerChip key={i} symbol={t.value} className="mx-0.5 align-baseline" />;
        if (t.type === 'url')
          return (
            <a key={i} href={t.value} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-neon-cyan underline decoration-cyan-400/30 underline-offset-2 hover:decoration-cyan-300">
              {t.value}
            </a>
          );
        if (t.type === 'mention') {
          const p = profiles.find((x) => [handleFor(x).toLowerCase(), x.display_name.split(/\s+/)[0].toLowerCase()].includes(t.value.toLowerCase()));
          if (!p) return <span key={i}>@{t.value}</span>;
          return (
            <span key={i} className={p.id === me ? 'rounded bg-amber-400/15 px-1 text-amber-200' : 'rounded bg-violet-400/15 px-1 text-violet-200'}>
              @{p.display_name}
            </span>
          );
        }
        return <span key={i}>{t.value}</span>;
      })}
    </span>
  );
}

export const MessageContent = memo(MessageContentInner);
