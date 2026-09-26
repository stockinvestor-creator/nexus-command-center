-- ═══════════════════════════════════════════════════════════════════════════
--  OPTIONAL — NOT REQUIRED for the TradingView update.
--
--  Older versions of NEXUS stored a price, % change and a sparkline inside shared-stock
--  chat messages (metadata.stock.price / changePercent / freshness / spark). With the old
--  "mock" provider those values were synthetic.
--
--  The new app IGNORES those fields completely, so nothing fake is displayed either way.
--  Run this only if you also want them removed from the database. It touches nothing else:
--  message text, authors, reactions, pins and the symbol itself are preserved.
--  Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

update public.messages
set metadata = jsonb_set(
      metadata,
      '{stock}',
      (metadata -> 'stock') - 'price' - 'changePercent' - 'freshness' - 'spark'
    )
where kind = 'stock_share'
  and metadata ? 'stock'
  and (metadata -> 'stock') ?| array['price', 'changePercent', 'freshness', 'spark'];
