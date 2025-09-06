import { query } from "./_lib/db.js";
import { rankSymbols } from "./_lib/rank.js";

/**
 * GET /api/top?since=24h&limit=100&halflife=24
 *  - since:  "12h", "24h", "3d", "2w"  (defaults to 24h)
 *  - limit:  max rows to return (default 100, max 300)
 *  - halflife: hours for recency decay (default 24)
 *
 * Output:
 * { since, results: [{ symbol, mentions, engagement, latest_ts, score }, ...] }
 */
export default async function handler(req, res) {
  try {
    const sinceRaw = String(req.query.since || "24h").toLowerCase();
    const limit = Math.min(parseInt(req.query.limit || "100", 10), 300);
    const halfLifeH = Math.max(1, parseInt(req.query.halflife || "24", 10));

    const interval = parseSinceToSqlInterval(sinceRaw);

    const { rows } = await query(
      `SELECT
          m.symbol,
          COUNT(*)::int          AS mentions,
          COALESCE(SUM(m.engagement),0)::int AS engagement,
          MAX(m.created_utc)     AS latest_ts
       FROM mentions m
       WHERE m.created_utc >= NOW() - INTERVAL '${interval}'
       GROUP BY m.symbol`
    );

    const ranked = rankSymbols(rows, { halfLifeH });
    res.status(200).json({ since: sinceRaw, results: ranked.slice(0, limit) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
}

/** Turn "24h" | "7d" | "2w" into a SQL INTERVAL string */
function parseSinceToSqlInterval(since) {
  const m = /^(\d+)\s*([hdw])$/.exec(since);
  if (!m) return "24 hours";
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit === "h") return `${n} hours`;
  if (unit === "d") return `${n} days`;
  if (unit === "w") return `${n * 7} days`;
  return "24 hours";
}
