import type { Exchange, ResolvedSymbol, SymbolMatch } from '@/types/market';

/**
 * Local symbol directory: ticker → company name + primary US listing exchange.
 *
 * Reference data only (names and listing venues). It contains NO prices.
 * `exchange: null` means we are not confident about the current primary listing,
 * so NEXUS passes the bare ticker and lets TradingView resolve it instead of guessing.
 * ETFs listed on NYSE Arca use TradingView's "AMEX:" prefix.
 */
interface DirectoryEntry {
  ticker: string;
  name: string;
  exchange: Exchange | null;
  type: 'Stock' | 'ETF';
  industry: string;
}

const D = (ticker: string, name: string, exchange: Exchange | null, industry: string, type: 'Stock' | 'ETF' = 'Stock'): DirectoryEntry => ({
  ticker,
  name,
  exchange,
  type,
  industry,
});

export const DIRECTORY: DirectoryEntry[] = [
  D('SPY', 'SPDR S&P 500 ETF Trust', 'AMEX', 'Index fund', 'ETF'),
  D('QQQ', 'Invesco QQQ Trust', 'NASDAQ', 'Index fund', 'ETF'),
  D('DIA', 'SPDR Dow Jones Industrial Average ETF', 'AMEX', 'Index fund', 'ETF'),
  D('IWM', 'iShares Russell 2000 ETF', 'AMEX', 'Index fund', 'ETF'),
  D('AAPL', 'Apple Inc.', 'NASDAQ', 'Consumer electronics'),
  D('MSFT', 'Microsoft Corporation', 'NASDAQ', 'Software'),
  D('NVDA', 'NVIDIA Corporation', 'NASDAQ', 'Semiconductors'),
  D('AMD', 'Advanced Micro Devices', 'NASDAQ', 'Semiconductors'),
  D('MU', 'Micron Technology', 'NASDAQ', 'Semiconductors'),
  D('AVGO', 'Broadcom Inc.', 'NASDAQ', 'Semiconductors'),
  D('INTC', 'Intel Corporation', 'NASDAQ', 'Semiconductors'),
  D('TSM', 'Taiwan Semiconductor Manufacturing', 'NYSE', 'Semiconductors'),
  D('SMCI', 'Super Micro Computer', 'NASDAQ', 'Hardware'),
  D('ARM', 'Arm Holdings', 'NASDAQ', 'Semiconductors'),
  D('GOOGL', 'Alphabet Inc. Class A', 'NASDAQ', 'Internet'),
  D('META', 'Meta Platforms', 'NASDAQ', 'Internet'),
  D('AMZN', 'Amazon.com Inc.', 'NASDAQ', 'E-commerce'),
  D('TSLA', 'Tesla Inc.', 'NASDAQ', 'Automobiles'),
  D('NFLX', 'Netflix Inc.', 'NASDAQ', 'Entertainment'),
  D('ORCL', 'Oracle Corporation', 'NYSE', 'Software'),
  D('IBM', 'International Business Machines', 'NYSE', 'IT services'),
  D('CRM', 'Salesforce Inc.', 'NYSE', 'Software'),
  D('ADBE', 'Adobe Inc.', 'NASDAQ', 'Software'),
  D('PLTR', 'Palantir Technologies', 'NASDAQ', 'Software'),
  D('SNOW', 'Snowflake Inc.', 'NYSE', 'Software'),
  D('CRWD', 'CrowdStrike Holdings', 'NASDAQ', 'Cybersecurity'),
  D('PANW', 'Palo Alto Networks', 'NASDAQ', 'Cybersecurity'),
  D('NET', 'Cloudflare Inc.', 'NYSE', 'Software'),
  D('SHOP', 'Shopify Inc.', null, 'E-commerce'),
  D('UBER', 'Uber Technologies', 'NYSE', 'Mobility'),
  D('COIN', 'Coinbase Global', 'NASDAQ', 'Crypto exchange'),
  D('MSTR', 'Strategy (MicroStrategy)', 'NASDAQ', 'Software'),
  D('MARA', 'MARA Holdings', 'NASDAQ', 'Crypto mining'),
  D('RIOT', 'Riot Platforms', 'NASDAQ', 'Crypto mining'),
  D('HOOD', 'Robinhood Markets', 'NASDAQ', 'Brokerage'),
  D('SOFI', 'SoFi Technologies', 'NASDAQ', 'Fintech'),
  D('JPM', 'JPMorgan Chase & Co.', 'NYSE', 'Banks'),
  D('GS', 'Goldman Sachs Group', 'NYSE', 'Capital markets'),
  D('BAC', 'Bank of America', 'NYSE', 'Banks'),
  D('V', 'Visa Inc.', 'NYSE', 'Payments'),
  D('BRK.B', 'Berkshire Hathaway Class B', 'NYSE', 'Conglomerate'),
  D('LMT', 'Lockheed Martin', 'NYSE', 'Defense'),
  D('RTX', 'RTX Corporation', 'NYSE', 'Defense'),
  D('NOC', 'Northrop Grumman', 'NYSE', 'Defense'),
  D('GD', 'General Dynamics', 'NYSE', 'Defense'),
  D('KTOS', 'Kratos Defense & Security', 'NASDAQ', 'Defense'),
  D('AVAV', 'AeroVironment', 'NASDAQ', 'Defense'),
  D('RKLB', 'Rocket Lab', 'NASDAQ', 'Aerospace'),
  D('BA', 'Boeing Company', 'NYSE', 'Aerospace'),
  D('CAT', 'Caterpillar Inc.', 'NYSE', 'Machinery'),
  D('GE', 'GE Aerospace', 'NYSE', 'Aerospace'),
  D('XOM', 'Exxon Mobil', 'NYSE', 'Oil & gas'),
  D('CVX', 'Chevron Corporation', 'NYSE', 'Oil & gas'),
  D('OXY', 'Occidental Petroleum', 'NYSE', 'Oil & gas'),
  D('LLY', 'Eli Lilly and Company', 'NYSE', 'Pharmaceuticals'),
  D('NVO', 'Novo Nordisk', 'NYSE', 'Pharmaceuticals'),
  D('UNH', 'UnitedHealth Group', 'NYSE', 'Managed care'),
  D('HUM', 'Humana Inc.', 'NYSE', 'Managed care'),
  D('PFE', 'Pfizer Inc.', 'NYSE', 'Pharmaceuticals'),
  D('MRNA', 'Moderna Inc.', 'NASDAQ', 'Biotechnology'),
  D('VRTX', 'Vertex Pharmaceuticals', 'NASDAQ', 'Biotechnology'),
  D('REGN', 'Regeneron Pharmaceuticals', 'NASDAQ', 'Biotechnology'),
  D('CRSP', 'CRISPR Therapeutics', 'NASDAQ', 'Biotechnology'),
  D('NVAX', 'Novavax Inc.', 'NASDAQ', 'Biotechnology'),
  D('WMT', 'Walmart Inc.', null, 'Retail'),
  D('COST', 'Costco Wholesale', 'NASDAQ', 'Retail'),
  D('KO', 'Coca-Cola Company', 'NYSE', 'Beverages'),
  D('DIS', 'Walt Disney Company', 'NYSE', 'Entertainment'),
  D('NKE', 'Nike Inc.', 'NYSE', 'Apparel'),
  D('GME', 'GameStop Corp.', 'NYSE', 'Specialty retail'),
  D('AMC', 'AMC Entertainment', 'NYSE', 'Entertainment'),
  D('RIVN', 'Rivian Automotive', 'NASDAQ', 'Automobiles'),
  D('LCID', 'Lucid Group', 'NASDAQ', 'Automobiles'),
  D('NIO', 'NIO Inc.', 'NYSE', 'Automobiles'),
  D('IONQ', 'IonQ Inc.', 'NYSE', 'Quantum computing'),
  D('SOUN', 'SoundHound AI', 'NASDAQ', 'AI software'),
  D('BBAI', 'BigBear.ai Holdings', 'NYSE', 'AI software'),
  D('AI', 'C3.ai Inc.', 'NYSE', 'AI software'),
  D('ASTS', 'AST SpaceMobile', 'NASDAQ', 'Satellite'),
];

const BY_TICKER = new Map(DIRECTORY.map((d) => [d.ticker, d]));
const EXCHANGES: Exchange[] = ['NASDAQ', 'NYSE', 'AMEX'];
const ALIASES: Record<string, Exchange> = { NASDAQ: 'NASDAQ', NYSE: 'NYSE', AMEX: 'AMEX', ARCA: 'AMEX', NYSEARCA: 'AMEX', 'NYSE ARCA': 'AMEX' };

export const lookupSymbol = (ticker: string) => BY_TICKER.get(ticker.toUpperCase().replace(/^\$/, ''));

/**
 * Resolve user input into a TradingView symbol.
 *  - "NYSE:IBM"  → exactly what the user typed (explicit exchange)
 *  - "NVDA"      → NASDAQ:NVDA when the directory knows the listing
 *  - "PUSA"      → bare "PUSA" (unverified; TradingView resolves it) — we never guess the exchange
 */
export function resolveSymbol(input: string): ResolvedSymbol | null {
  const raw = input.trim().replace(/^\$/, '').toUpperCase();
  if (!raw) return null;
  const m = /^([A-Z ]{2,10}):([A-Z0-9.\-]{1,12})$/.exec(raw);
  if (m) {
    const ex = ALIASES[m[1].trim()];
    const ticker = m[2];
    const known = BY_TICKER.get(ticker);
    if (ex) return { ticker, exchange: ex, tvSymbol: `${ex}:${ticker}`, name: known?.name, verified: true };
    // an exchange TradingView knows but NEXUS doesn't list (e.g. OTC): pass through untouched
    return { ticker, exchange: null, tvSymbol: `${m[1].trim()}:${ticker}`, name: known?.name, verified: true };
  }
  if (!/^[A-Z0-9.\-]{1,12}$/.test(raw)) return null;
  const known = BY_TICKER.get(raw);
  if (known?.exchange) return { ticker: raw, exchange: known.exchange, tvSymbol: `${known.exchange}:${raw}`, name: known.name, verified: true };
  return { ticker: raw, exchange: null, tvSymbol: raw, name: known?.name, verified: false };
}

/** Converts a ticker or TradingView symbol to its bare ticker ("NASDAQ:NVDA" → "NVDA"). */
export const tickerOf = (symbol: string) => symbol.toUpperCase().replace(/^\$/, '').split(':').pop() ?? symbol;

/** TradingView symbol for a bare ticker (never guesses an unknown exchange). */
export const tvSymbolFor = (ticker: string) => resolveSymbol(ticker)?.tvSymbol ?? ticker.toUpperCase();

export const isExchange = (s: string): s is Exchange => (EXCHANGES as string[]).includes(s);

/** Instant local search — zero API calls, no prices. */
export function searchDirectory(query: string, limit = 8): SymbolMatch[] {
  const q = query.trim().toUpperCase().replace(/^\$/, '');
  if (!q) return [];
  return DIRECTORY.map((u) => {
    const n = u.name.toUpperCase();
    let score = 0;
    if (u.ticker === q) score = 100;
    else if (u.ticker.startsWith(q)) score = 80 - u.ticker.length;
    else if (n.startsWith(q)) score = 60;
    else if (n.includes(q)) score = 40;
    else if (u.industry.toUpperCase().includes(q)) score = 20;
    return { u, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ u }) => ({ symbol: u.ticker, name: u.name, exchange: u.exchange ?? undefined, type: u.type, region: 'United States' }));
}
