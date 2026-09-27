import { ExternalLink, FileText, Globe, PlayCircle } from 'lucide-react';
import { useMarketQuery } from '@/hooks/useMarketQuery';
import { intel } from '@/services/intel/client';

function youtubeId(u: URL): string | null {
  if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
  if (u.hostname.endsWith('youtube.com')) return u.searchParams.get('v');
  return null;
}

/**
 * Safe link preview. Metadata (title/description/site/image) is fetched server-side by the
 * link-preview Netlify Function, which blocks private/internal addresses (SSRF protection), limits
 * redirects/size/time, never executes page JavaScript and never returns article bodies. Finviz is
 * never fetched. SEC filing links show form/company/filed date from EDGAR. If the function is
 * unavailable we fall back to the domain + path only.
 */
export function LinkPreview({ url }: { url: string }) {
  let u: URL | null = null;
  try {
    u = new URL(url);
  } catch {
    u = null;
  }
  const ok = Boolean(u && /^https?:$/.test(u.protocol));
  const yt = ok ? youtubeId(u!) : null;
  const q = useMarketQuery(ok && !yt ? `lp:${url}` : null, () => intel.linkPreview(url), { staleMs: 24 * 3600_000 });
  if (!ok || !u) return null;
  const meta = q.data?.data;
  const domain = u.hostname.replace(/^www\./, '');
  const path = decodeURIComponent(u.pathname + u.search).slice(0, 80);
  const image = meta?.image && /^https:\/\//.test(meta.image) ? meta.image : null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-1.5 flex max-w-md overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition hover:border-neon-cyan/30"
    >
      {yt ? (
        <div className="relative w-32 shrink-0">
          <img src={`https://i.ytimg.com/vi/${encodeURIComponent(yt)}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
          <PlayCircle className="absolute inset-0 m-auto h-8 w-8 text-white/90" />
        </div>
      ) : image ? (
        <img src={image} alt="" className="w-24 shrink-0 object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : null}
      <div className="min-w-0 flex-1 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-neon-cyan">
          {meta?.kind === 'sec' ? <FileText className="h-3 w-3" /> : <Globe className="h-3 w-3" />} {meta?.siteName ?? domain}
          {meta?.kind === 'sec' && <span className="rounded border border-sky-400/30 px-1 font-mono text-[9px] text-sky-200">SOURCE: SEC</span>}
          {meta?.kind === 'finviz' && <span className="rounded border border-white/10 px-1 font-mono text-[9px] text-slate-400">external link</span>}
          <ExternalLink className="ml-auto h-3 w-3 text-slate-500" />
        </div>
        {meta?.title ? <p className="line-clamp-2 text-xs font-medium text-slate-200">{meta.title}</p> : <p className="truncate font-mono text-[11px] text-slate-400">{path === '/' ? url : path}</p>}
        {meta?.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{meta.description}</p>}
      </div>
    </a>
  );
}
