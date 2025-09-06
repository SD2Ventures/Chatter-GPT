CREATE TABLE IF NOT EXISTS ticker_stats (
  domain TEXT NOT NULL,
  symbol TEXT NOT NULL,
  ema_count DOUBLE PRECISION,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (domain, symbol)
);

CREATE TABLE IF NOT EXISTS posts_ingested (
  source TEXT NOT NULL,
  post_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS chatter_rank (
  domain TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name   TEXT,
  chatter_score DOUBLE PRECISION NOT NULL,
  reason TEXT,
  last_seen TIMESTAMPTZ NOT NULL,
  evidence JSONB,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (domain, symbol)
);

CREATE TABLE IF NOT EXISTS chatter_explain (
  domain TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name   TEXT,
  chatter_score DOUBLE PRECISION NOT NULL,
  signals JSONB,
  evidence JSONB,
  last_seen TIMESTAMPTZ NOT NULL,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (domain, symbol)
);

CREATE TABLE IF NOT EXISTS sec_events (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT,
  event_type TEXT,
  filing_date TIMESTAMPTZ,
  url TEXT
);

CREATE INDEX IF NOT EXISTS idx_chatter_rank_domain_score
  ON chatter_rank (domain, chatter_score DESC);
