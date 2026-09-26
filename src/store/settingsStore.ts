import { create } from 'zustand';
import { safeStorage } from '@/lib/safeStorage';

export type WidgetKey = 'tickerTape' | 'heatmap' | 'marketOverview' | 'symbolInfo' | 'economicCalendar' | 'topStories' | 'advancedChart' | 'hotlists';

export interface SettingsState {
  sidebarCollapsed: boolean;
  particles: boolean;
  shapes: boolean;
  browserNotifications: boolean;
  sounds: boolean;
  widgets: Record<WidgetKey, boolean>;
  collapsedCards: Record<string, boolean>;
  dashboardSymbol: string;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'toggleWidget' | 'toggleCard'>>) => void;
  toggleWidget: (k: WidgetKey) => void;
  toggleCard: (id: string) => void;
}

const KEY = 'ncc.settings.v1';
const defaults = {
  sidebarCollapsed: false,
  particles: true,
  shapes: true,
  browserNotifications: false,
  sounds: false,
  widgets: {
    tickerTape: true,
    heatmap: true,
    marketOverview: true,
    symbolInfo: true,
    economicCalendar: true,
    topStories: true,
    advancedChart: true,
    hotlists: true,
  } as Record<WidgetKey, boolean>,
  collapsedCards: {} as Record<string, boolean>,
  dashboardSymbol: 'SPY',
};

type Persisted = typeof defaults;
const stored = safeStorage.get<Partial<Persisted>>(KEY, {});
const initial: Persisted = { ...defaults, ...stored, widgets: { ...defaults.widgets, ...(stored.widgets ?? {}) } };

export const useSettings = create<SettingsState>((set, get) => {
  const save = () => {
    const { set: _s, toggleWidget: _t, toggleCard: _c, ...rest } = get();
    void _s;
    void _t;
    void _c;
    safeStorage.set(KEY, rest);
  };
  return {
    ...initial,
    set: (patch) => {
      set(patch);
      save();
    },
    toggleWidget: (k) => {
      set((s) => ({ widgets: { ...s.widgets, [k]: !s.widgets[k] } }));
      save();
    },
    toggleCard: (id) => {
      set((s) => ({ collapsedCards: { ...s.collapsedCards, [id]: !s.collapsedCards[id] } }));
      save();
    },
  };
});
