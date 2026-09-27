/** Sector tags derived from issuing agencies (see netlify/lib/policy.ts). */
export const POLICY_SECTORS = ['Semiconductors', 'Technology', 'Healthcare', 'Biotechnology', 'Managed care', 'Financials', 'Banks', 'Crypto', 'Energy', 'Defense', 'Industrials', 'Consumer', 'Internet', 'Retail'];

/** Directory industry → sector tags used to find "potentially related" policy items. */
export function sectorTagsForIndustry(industry: string | undefined): string[] {
  if (!industry) return [];
  const i = industry.toLowerCase();
  const out = new Set<string>();
  if (/semi|hardware/.test(i)) out.add('Semiconductors').add('Hardware').add('Technology');
  if (/software|internet|it services|cyber|ai software|e-commerce/.test(i)) out.add('Technology').add('Internet').add('Software');
  if (/biotech|pharma/.test(i)) out.add('Healthcare').add('Biotechnology').add('Pharmaceuticals');
  if (/managed care/.test(i)) out.add('Managed care').add('Healthcare');
  if (/bank|capital markets|brokerage|payments|fintech/.test(i)) out.add('Financials').add('Banks');
  if (/crypto/.test(i)) out.add('Crypto').add('Financials');
  if (/oil|gas|energy/.test(i)) out.add('Energy').add('Oil & gas');
  if (/defense|aerospace/.test(i)) out.add('Defense').add('Aerospace');
  if (/retail|apparel|beverages|consumer/.test(i)) out.add('Consumer').add('Retail');
  if (/machinery|automobiles|industr|mobility/.test(i)) out.add('Industrials');
  return [...out];
}
