import { CandlestickChart, LayoutDashboard, MessagesSquare, Settings, Star, Swords, Users, Zap, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Command Center', short: 'Home', icon: LayoutDashboard, mobile: true },
  { to: '/markets', label: 'Markets', short: 'Markets', icon: CandlestickChart, mobile: true },
  { to: '/watchlist', label: 'Watchlist', short: 'Watch', icon: Star },
  { to: '/catalysts', label: 'Catalyst Feed', short: 'Catalysts', icon: Zap, mobile: true },
  { to: '/war-room', label: 'Trade War Room', short: 'War Room', icon: Swords, mobile: true },
  { to: '/messages', label: 'Messages', short: 'Chat', icon: MessagesSquare, mobile: true },
  { to: '/groups', label: 'Groups', short: 'Groups', icon: Users },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings },
];
