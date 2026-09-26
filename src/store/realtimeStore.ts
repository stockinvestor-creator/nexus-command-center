import { create } from 'zustand';
import { backend, type PresenceUser, type RealtimeRoom } from '@/services/backend';

interface TypingEntry {
  userId: string;
  name: string;
  at: number;
}

interface RealtimeState {
  room: RealtimeRoom | null;
  online: PresenceUser[];
  typing: Record<string, TypingEntry[]>;
  unread: Record<string, number>;
  setRoom: (r: RealtimeRoom | null) => void;
  setOnline: (u: PresenceUser[]) => void;
  addTyping: (channelId: string, e: TypingEntry) => void;
  pruneTyping: () => void;
  refreshUnread: () => Promise<void>;
  clearUnread: (channelId: string) => void;
}

export const useRealtime = create<RealtimeState>((set, get) => ({
  room: null,
  online: [],
  typing: {},
  unread: {},
  setRoom: (room) => set({ room }),
  setOnline: (online) => set({ online }),
  addTyping: (channelId, e) =>
    set((s) => ({
      typing: { ...s.typing, [channelId]: [...(s.typing[channelId] ?? []).filter((x) => x.userId !== e.userId), e] },
    })),
  pruneTyping: () => {
    const now = Date.now();
    const cur = get().typing;
    let changed = false;
    const next: Record<string, TypingEntry[]> = {};
    for (const [k, v] of Object.entries(cur)) {
      const kept = v.filter((x) => now - x.at < 4000);
      if (kept.length !== v.length) changed = true;
      if (kept.length) next[k] = kept;
    }
    if (changed) set({ typing: next });
  },
  refreshUnread: async () => {
    try {
      set({ unread: await backend.unreadCounts() });
    } catch {
      /* offline / not configured */
    }
  },
  clearUnread: (channelId) => set((s) => ({ unread: { ...s.unread, [channelId]: 0 } })),
}));

export const useIsOnline = (userId: string | null | undefined) =>
  useRealtime((s) => (userId ? s.online.some((u) => u.id === userId) : false));
