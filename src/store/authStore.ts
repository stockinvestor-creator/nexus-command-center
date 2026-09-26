import { create } from 'zustand';
import { backend, type AuthUser } from '@/services/backend';
import type { Profile } from '@/types/db';

interface AuthState {
  ready: boolean;
  user: AuthUser | null;
  profile: Profile | null;
  profiles: Profile[];
  profileError: string | null;
  init: () => () => void;
  loadProfiles: () => Promise<void>;
  setProfiles: (p: Profile[]) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  user: null,
  profile: null,
  profiles: [],
  profileError: null,
  init: () => {
    const apply = async (user: AuthUser | null) => {
      set({ user, ready: !user ? true : get().ready });
      if (user) {
        await get().loadProfiles();
        set({ ready: true });
      } else {
        set({ profile: null, profiles: [] });
      }
    };
    void backend.getUser().then(apply);
    const off = backend.onAuthChange((u) => {
      if (u?.id !== get().user?.id) void apply(u);
    });
    const offRt = backend.subscribe('profiles', () => void get().loadProfiles());
    return () => {
      off();
      offRt();
    };
  },
  loadProfiles: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const profiles = await backend.select('profiles', { order: { column: 'created_at' } });
      const profile = profiles.find((p) => p.id === user.id) ?? null;
      set({
        profiles,
        profile,
        profileError: profile
          ? null
          : 'Your account has no workspace profile. Make sure your email is in public.allowed_emails and that schema.sql ran before the account was created.',
      });
    } catch (e) {
      set({ profileError: (e as Error).message });
    }
  },
  setProfiles: (profiles) => set({ profiles }),
}));

/** Profile lookup helper that works outside React render (e.g. in services) */
export const profileById = (id: string | null | undefined): Profile | undefined =>
  id ? useAuth.getState().profiles.find((p) => p.id === id) : undefined;
