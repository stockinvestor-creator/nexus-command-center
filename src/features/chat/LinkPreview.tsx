import { ExternalLink, Globe, PlayCircle } from 'lucide-react';

function youtubeId(u: URL): string | null {
  if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
  if (u.hostname.endsWith('youtube.com')) return u.searchParams.get('v');
  return null;
}

/**
 * Privacy-safe link preview: we never fetch the target page (no server, no third-party preview
 * service, no tracking). We show the domain/path, and a thumbnail only for YouTube links.
 */
export function LinkPreview({ url }: { url: string }) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const yt = youtubeId(u);
  const path = decodeURIComponent(u.pathname + u.search).slice(0, 80);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-1.5 flex max-w-md overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition hover:border-neon-cyan/30"
    >
      {yt && (
        <div className="relative w-32 shrink-0">
          <img src={`https://i.ytimg.com/vi/${encodeURIComponent(yt)}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
          <PlayCircle className="absolute inset-0 m-auto h-8 w-8 text-white/90" />
        </div>
      )}
      <div className="min-w-0 flex-1 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-neon-cyan">
          <Globe className="h-3 w-3" /> {u.hostname.replace(/^www\./, '')}
          <ExternalLink className="ml-auto h-3 w-3 text-slate-500" />
        </div>
        <p className="truncate font-mono text-[11px] text-slate-400">{path === '/' ? url : path}</p>
      </div>
    </a>
  );
}
