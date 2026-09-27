import { create } from 'zustand';

/** Global "WHY IS IT MOVING?" drawer — can be opened from any page for any ticker. */
export const useWhy = create<{ symbol: string | null; open: (s: string) => void; close: () => void }>((set) => ({
  symbol: null,
  open: (symbol) => set({ symbol: symbol.toUpperCase().replace(/^\$/, '').split(':').pop() ?? symbol }),
  close: () => set({ symbol: null }),
}));
