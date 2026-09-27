import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { GlobalSearch } from './GlobalSearch';
import { NAV } from './nav';
import { create } from 'zustand';

export const usePalette = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** ⌘K / Ctrl+K: jump to any ticker or page */
export function CommandPalette() {
  const { open, setOpen } = usePalette();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!usePalette.getState().open);
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Search everything" size="md">
      <GlobalSearch onDone={() => setOpen(false)} />
      <p className="label mb-2 mt-5">Jump to</p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {NAV.map((n) => (
          <button
            key={n.to}
            onClick={() => {
              setOpen(false);
              navigate(n.to);
            }}
            className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-300 transition hover:border-neon-cyan/30 hover:text-white"
          >
            <n.icon className="h-4 w-4 text-neon-cyan" />
            {n.short}
          </button>
        ))}
      </div>
      <p className="mt-4 font-mono text-[10px] text-slate-600">Tip: press ⌘K / Ctrl+K or “/” anywhere.</p>
    </Modal>
  );
}
