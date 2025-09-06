import { query } from "../_lib/db.js";

const SQL = `
CREATE TABLE IF NOT EXISTS posts_ingested (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,               -- 'reddit'|'web'
  external_id TEXT UNIQUE,            -- reddit id or URL hash
  url TEXT,
  title TEXT,
  author TEXT,
  channel TEXT,                       -- subreddit or site label
  created_utc TIMESTAMPTZ,
  score INT,
  num_comments INT,
  fulltext TEXT,
  symbols TEXT[],
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentions (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  count INT DEFAULT 1,
  created_utc TIMESTAMPTZ,
  source TEXT NOT NULL,
  engagement INT DEFAULT 0,           -- score + comments for reddit; 1 for web
  UNIQUE(external_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts_ingested(created_utc);
CREATE INDEX IF NOT EXISTS idx_posts_symbols ON posts_ingested USING GIN(symbols);
CREATE INDEX IF NOT EXISTS idx_mentions_symbol ON mentions(symbol);
CREATE INDEX IF NOT EXISTS idx_mentions_created ON mentions(created_utc);
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed (POST required)" });
  }

  // --- Token enforcement ---
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const expected = process.env.ADMIN_INIT_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // -------------------------

  try {
    await query(SQL);
    res.status(200).json({ ok: true, message: "Schema ensured" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
}
