import { create } from 'zustand';
import { uid } from '@/lib/id';

export type ToastTone = 'info' | 'success' | 'error' | 'warning';
export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: ToastTone;
  link?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'tone'> & { tone?: ToastTone }) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const toast: Toast = { id: uid(), tone: 'info', ...t };
    set({ toasts: [...get().toasts.slice(-3), toast] });
    window.setTimeout(() => get().dismiss(toast.id), toast.tone === 'error' ? 7000 : 4500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export const toast = {
  info: (title: string, body?: string, link?: string) => useToasts.getState().push({ title, body, link, tone: 'info' }),
  success: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'success' }),
  error: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'error' }),
  warning: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'warning' }),
};

/** Wrap an async action: shows an error toast instead of throwing */
export async function attempt<T>(fn: () => Promise<T>, errorTitle = 'Something went wrong'): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    toast.error(errorTitle, (e as Error).message);
    return undefined;
  }
}
