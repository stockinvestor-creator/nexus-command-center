import type { SymbolMatch } from '@/types/market';

export interface UniverseEntry {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  /** Rough reference price used only to seed DEMO data */
  base: number;
  /** Annualized volatility used only to seed DEMO data */
  vol: number;
}

/**
 * Local symbol directory. Used for instant search (no API calls) and to seed DEMO data.
 * Reference prices are illustrative seeds for the mock provider only — never shown as real prices.
 */
export const UNIVERSE: UniverseEntry[] = [
  ['SPY', 'SPDR S&P 500 ETF Trust', 'NYSE Arca', 'ETF', 'Index Fund', 560, 0.16],
  ['QQQ', 'Invesco QQQ Trust', 'NASDAQ', 'ETF', 'Index Fund', 480, 0.21],
  ['DIA', 'SPDR Dow Jones Industrial Average ETF', 'NYSE Arca', 'ETF', 'Index Fund', 420, 0.14],
  ['IWM', 'iShares Russell 2000 ETF', 'NYSE Arca', 'ETF', 'Index Fund', 215, 0.23],
  ['AAPL', 'Apple Inc.', 'NASDAQ', 'Technology', 'Consumer Electronics', 225, 0.26],
  ['MSFT', 'Microsoft Corporation', 'NASDAQ', 'Technology', 'Software', 430, 0.24],
  ['NVDA', 'NVIDIA Corporation', 'NASDAQ', 'Technology', 'Semiconductors', 125, 0.5],
  ['AMD', 'Advanced Micro Devices', 'NASDAQ', 'Technology', 'Semiconductors', 150, 0.48],
  ['MU', 'Micron Technology', 'NASDAQ', 'Technology', 'Semiconductors', 100, 0.5],
  ['AVGO', 'Broadcom Inc.', 'NASDAQ', 'Technology', 'Semiconductors', 170, 0.42],
  ['INTC', 'Intel Corporation', 'NASDAQ', 'Technology', 'Semiconductors', 22, 0.45],
  ['TSM', 'Taiwan Semiconductor', 'NYSE', 'Technology', 'Semiconductors', 180, 0.38],
  ['SMCI', 'Super Micro Computer', 'NASDAQ', 'Technology', 'Hardware', 40, 0.9],
  ['ARM', 'Arm Holdings', 'NASDAQ', 'Technology', 'Semiconductors', 140, 0.7],
  ['GOOGL', 'Alphabet Inc. Class A', 'NASDAQ', 'Communication', 'Internet', 170, 0.3],
  ['META', 'Meta Platforms', 'NASDAQ', 'Communication', 'Internet', 560, 0.36],
  ['AMZN', 'Amazon.com Inc.', 'NASDAQ', 'Consumer', 'E-Commerce', 190, 0.32],
  ['TSLA', 'Tesla Inc.', 'NASDAQ', 'Consumer', 'Automobiles', 240, 0.6],
  ['NFLX', 'Netflix Inc.', 'NASDAQ', 'Communication', 'Entertainment', 700, 0.38],
  ['ORCL', 'Oracle Corporation', 'NYSE', 'Technology', 'Software', 170, 0.32],
  ['CRM', 'Salesforce Inc.', 'NYSE', 'Technology', 'Software', 280, 0.34],
  ['ADBE', 'Adobe Inc.', 'NASDAQ', 'Technology', 'Software', 500, 0.34],
  ['PLTR', 'Palantir Technologies', 'NASDAQ', 'Technology', 'Software', 40, 0.65],
  ['SNOW', 'Snowflake Inc.', 'NYSE', 'Technology', 'Software', 130, 0.6],
  ['CRWD', 'CrowdStrike Holdings', 'NASDAQ', 'Technology', 'Cybersecurity', 300, 0.5],
  ['PANW', 'Palo Alto Networks', 'NASDAQ', 'Technology', 'Cybersecurity', 360, 0.38],
  ['NET', 'Cloudflare Inc.', 'NYSE', 'Technology', 'Software', 90, 0.6],
  ['SHOP', 'Shopify Inc.', 'NYSE', 'Technology', 'E-Commerce', 80, 0.6],
  ['UBER', 'Uber Technologies', 'NYSE', 'Technology', 'Mobility', 72, 0.42],
  ['COIN', 'Coinbase Global', 'NASDAQ', 'Financials', 'Crypto Exchange', 230, 0.8],
  ['MSTR', 'MicroStrategy (Strategy)', 'NASDAQ', 'Technology', 'Bitcoin Treasury', 180, 1.0],
  ['MARA', 'MARA Holdings', 'NASDAQ', 'Financials', 'Crypto Mining', 18, 1.0],
  ['RIOT', 'Riot Platforms', 'NASDAQ', 'Financials', 'Crypto Mining', 9, 1.0],
  ['HOOD', 'Robinhood Markets', 'NASDAQ', 'Financials', 'Brokerage', 24, 0.7],
  ['SOFI', 'SoFi Technologies', 'NASDAQ', 'Financials', 'Fintech', 9, 0.6],
  ['JPM', 'JPMorgan Chase & Co.', 'NYSE', 'Financials', 'Banks', 210, 0.22],
  ['GS', 'Goldman Sachs Group', 'NYSE', 'Financials', 'Capital Markets', 500, 0.26],
  ['BAC', 'Bank of America', 'NYSE', 'Financials', 'Banks', 40, 0.26],
  ['V', 'Visa Inc.', 'NYSE', 'Financials', 'Payments', 280, 0.2],
  ['BRK.B', 'Berkshire Hathaway Class B', 'NYSE', 'Financials', 'Conglomerate', 450, 0.16],
  ['LMT', 'Lockheed Martin', 'NYSE', 'Industrials', 'Defense', 560, 0.2],
  ['RTX', 'RTX Corporation', 'NYSE', 'Industrials', 'Defense', 120, 0.22],
  ['NOC', 'Northrop Grumman', 'NYSE', 'Industrials', 'Defense', 510, 0.2],
  ['GD', 'General Dynamics', 'NYSE', 'Industrials', 'Defense', 300, 0.18],
  ['KTOS', 'Kratos Defense & Security', 'NASDAQ', 'Industrials', 'Defense', 24, 0.5],
  ['AVAV', 'AeroVironment', 'NASDAQ', 'Industrials', 'Defense', 200, 0.5],
  ['RKLB', 'Rocket Lab USA', 'NASDAQ', 'Industrials', 'Aerospace', 10, 0.8],
  ['BA', 'Boeing Company', 'NYSE', 'Industrials', 'Aerospace', 160, 0.35],
  ['CAT', 'Caterpillar Inc.', 'NYSE', 'Industrials', 'Machinery', 360, 0.28],
  ['GE', 'GE Aerospace', 'NYSE', 'Industrials', 'Aerospace', 180, 0.3],
  ['XOM', 'Exxon Mobil', 'NYSE', 'Energy', 'Oil & Gas', 115, 0.24],
  ['CVX', 'Chevron Corporation', 'NYSE', 'Energy', 'Oil & Gas', 150, 0.24],
  ['OXY', 'Occidental Petroleum', 'NYSE', 'Energy', 'Oil & Gas', 55, 0.32],
  ['LLY', 'Eli Lilly and Company', 'NYSE', 'Healthcare', 'Pharmaceuticals', 900, 0.32],
  ['NVO', 'Novo Nordisk', 'NYSE', 'Healthcare', 'Pharmaceuticals', 120, 0.34],
  ['UNH', 'UnitedHealth Group', 'NYSE', 'Healthcare', 'Managed Care', 580, 0.26],
  ['HUM', 'Humana Inc.', 'NYSE', 'Healthcare', 'Managed Care', 300, 0.36],
  ['PFE', 'Pfizer Inc.', 'NYSE', 'Healthcare', 'Pharmaceuticals', 29, 0.24],
  ['MRNA', 'Moderna Inc.', 'NASDAQ', 'Healthcare', 'Biotechnology', 70, 0.6],
  ['VRTX', 'Vertex Pharmaceuticals', 'NASDAQ', 'Healthcare', 'Biotechnology', 470, 0.28],
  ['REGN', 'Regeneron Pharmaceuticals', 'NASDAQ', 'Healthcare', 'Biotechnology', 1000, 0.3],
  ['CRSP', 'CRISPR Therapeutics', 'NASDAQ', 'Healthcare', 'Biotechnology', 50, 0.7],
  ['SAVA', 'Cassava Sciences', 'NASDAQ', 'Healthcare', 'Biotechnology', 25, 1.1],
  ['NVAX', 'Novavax Inc.', 'NASDAQ', 'Healthcare', 'Biotechnology', 12, 0.9],
  ['WMT', 'Walmart Inc.', 'NYSE', 'Consumer', 'Retail', 80, 0.18],
  ['COST', 'Costco Wholesale', 'NASDAQ', 'Consumer', 'Retail', 880, 0.2],
  ['KO', 'Coca-Cola Company', 'NYSE', 'Consumer', 'Beverages', 70, 0.14],
  ['DIS', 'Walt Disney Company', 'NYSE', 'Communication', 'Entertainment', 95, 0.3],
  ['NKE', 'Nike Inc.', 'NYSE', 'Consumer', 'Apparel', 80, 0.32],
  ['GME', 'GameStop Corp.', 'NYSE', 'Consumer', 'Specialty Retail', 22, 1.0],
  ['AMC', 'AMC Entertainment', 'NYSE', 'Communication', 'Entertainment', 4.5, 1.1],
  ['RIVN', 'Rivian Automotive', 'NASDAQ', 'Consumer', 'Automobiles', 12, 0.75],
  ['LCID', 'Lucid Group', 'NASDAQ', 'Consumer', 'Automobiles', 3, 0.8],
  ['NIO', 'NIO Inc.', 'NYSE', 'Consumer', 'Automobiles', 5, 0.8],
  ['IONQ', 'IonQ Inc.', 'NYSE', 'Technology', 'Quantum Computing', 12, 1.0],
  ['SOUN', 'SoundHound AI', 'NASDAQ', 'Technology', 'AI Software', 6, 1.0],
  ['BBAI', 'BigBear.ai Holdings', 'NYSE', 'Technology', 'AI Software', 3, 1.1],
  ['AI', 'C3.ai Inc.', 'NYSE', 'Technology', 'AI Software', 25, 0.7],
  ['ASTS', 'AST SpaceMobile', 'NASDAQ', 'Communication', 'Satellite', 25, 1.0],
].map(([symbol, name, exchange, sector, industry, base, vol]) => ({
  symbol: symbol as string,
  name: name as string,
  exchange: exchange as string,
  sector: sector as string,
  industry: industry as string,
  base: base as number,
  vol: vol as number,
}));

const BY_SYMBOL = new Map(UNIVERSE.map((u) => [u.symbol, u]));

export const lookupUniverse = (symbol: string) => BY_SYMBOL.get(symbol.toUpperCase());

/** Instant local search — costs zero API calls. */
export function searchUniverse(query: string, limit = 8): SymbolMatch[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const scored = UNIVERSE.map((u) => {
    const s = u.symbol;
    const n = u.name.toUpperCase();
    let score = 0;
    if (s === q) score = 100;
    else if (s.startsWith(q)) score = 80 - s.length;
    else if (n.startsWith(q)) score = 60;
    else if (n.includes(q)) score = 40;
    else if (u.industry.toUpperCase().includes(q)) score = 20;
    return { u, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ u }) => ({ symbol: u.symbol, name: u.name, exchange: u.exchange, type: 'Equity', region: 'United States' }));
}

export const INDEX_PROXIES = [
  { symbol: 'SPY', label: 'S&P 500', proxy: 'SPY ETF proxy' },
  { symbol: 'QQQ', label: 'Nasdaq 100', proxy: 'QQQ ETF proxy' },
  { symbol: 'DIA', label: 'Dow Jones', proxy: 'DIA ETF proxy' },
] as const;
