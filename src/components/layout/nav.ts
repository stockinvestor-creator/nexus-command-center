import {
  BookOpenText, Briefcase, CandlestickChart, GitCompare, HelpCircle, LayoutDashboard, MessagesSquare, Settings, Sparkles, Star, Swords, Target, Users, Zap, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  mobile?: boolean;
  group: 'Today' | 'Markets' | 'Trading' | 'Team';
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Command Center', short: 'Home', icon: LayoutDashboard, mobile: true, group: 'Today' },
  { to: '/briefing', label: 'Morning Briefing', short: 'Briefing', icon: Sparkles, mobile: true, group: 'Today' },
  { to: '/catalysts', label: 'Catalyst Intelligence', short: 'Catalysts', icon: Zap, mobile: true, group: 'Today' },
  { to: '/why', label: 'Why Is It Moving?', short: 'Why moving', icon: HelpCircle, group: 'Today' },
  { to: '/markets', label: 'Markets', short: 'Markets', icon: CandlestickChart, mobile: true, group: 'Markets' },
  { to: '/watchlist', label: 'Watchlist', short: 'Watch', icon: Star, group: 'Markets' },
  { to: '/research', label: 'Research', short: 'Research', icon: BookOpenText, group: 'Markets' },
  { to: '/compare', label: 'Compare', short: 'Compare', icon: GitCompare, group: 'Markets' },
  { to: '/portfolio', label: 'Portfolio Simulator', short: 'Portfolio', icon: Briefcase, group: 'Trading' },
  { to: '/predictions', label: 'Predictions', short: 'Predictions', icon: Target, group: 'Trading' },
  { to: '/war-room', label: 'Trade War Room', short: 'War Room', icon: Swords, group: 'Trading' },
  { to: '/messages', label: 'Messages', short: 'Chat', icon: MessagesSquare, mobile: true, group: 'Team' },
  { to: '/groups', label: 'Groups', short: 'Groups', icon: Users, group: 'Team' },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings, group: 'Team' },
];
