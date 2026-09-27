import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import type { ResearchSection } from '@/types/db';

export const SECTION_META: Record<ResearchSection, { label: string; hint: string }> = {
  bull: { label: 'Bull case', hint: 'What has to go right' },
  bear: { label: 'Bear case', hint: 'What could go wrong' },
  catalysts: { label: 'Catalysts', hint: 'Dated events that could move the stock (link sources)' },
  risks: { label: 'Key risks', hint: 'Dilution, balance sheet, competition, regulation…' },
  valuation: { label: 'Valuation', hint: 'Your assumptions — label them as estimates' },
  technical: { label: 'Technical levels', hint: 'Levels you are watching' },
  links: { label: 'Links & IR', hint: 'One link per line, e.g. "Investor relations https://ir.example.com"' },
  general: { label: 'General notes', hint: '' },
};

export function saveSection(symbol: string, section: ResearchSection, content: string) {
  const uid = useAuth.getState().user?.id ?? null;
  return backend.upsert('research_notes', { symbol: symbol.toUpperCase(), section, content, updated_by: uid }, ['symbol', 'section']);
}
