import { query } from "./_lib/db.js";

/**
 * GET /api/explain?symbol=TSLA&since=7d
 *  - symbol: required, e.g. "NVDA"
 *  - since:  "12h", "7d", "2w" (default 7d)
 *
 * Output:
 * { symbol, since, posts: [{ external_id, url, title, author, channel, created_utc, score, num_comments }] }
 */
export default async function handler(req, res) {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase().trim();
    if (!symbol) {
      return res.status(400).json({ error: "symbol is required (e.g., ?symbol=NVDA)" });
    }

    const sinceRaw = String(req.query.since || "7d").toLowerCase();
    const interval = parseSinceToSqlInterval(sinceRaw);

    const { rows } = await query(
      `SELECT
          p.external_id,
          p.url,
          p.title,
          p.author,
          p.channel,
          p.created_utc,
          p.score,
          p.num_comments
       FROM posts_ingested p
       JOIN mentions m ON m.external_id = p.external_id
       WHERE m.symbol = $1
         AND m.created_utc >= NOW() - INTERVAL '${interval}'
       ORDER BY p.created_utc DESC
       LIMIT 200`,
      [symbol]
    );

    res.status(200).json({ symbol, since: sinceRaw, posts: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
}

/** Turn "24h" | "7d" | "2w" into a SQL INTERVAL string */
function parseSinceToSqlInterval(since) {
  const m = /^(\d+)\s*([hdw])$/.exec(since);
  if (!m) return "7 days";
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit === "h") return `${n} hours`;
  if (unit === "d") return `${n} days`;
  if (unit === "w") return `${n * 7} days`;
  return "7 days";
}
