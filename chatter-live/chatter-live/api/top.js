// Returns the highest chatter for a domain in the last window (minutes).
// GET /api/top?domain=stocks|crypto&window_min=60

import { query } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const domain = (url.searchParams.get('domain') || 'stocks').toLowerCase();
    const win = Math.max(5, Math.min(1440, parseInt(url.searchParams.get('window_min') || '60', 10)));
    if (!['stocks','crypto'].includes(domain)) {
      res.status(400).json({ error: 'domain must be stocks or crypto' }); return;
    }
    const rows = await query(
      `SELECT symbol, name, chatter_score, reason, last_seen, evidence, as_of
       FROM chatter_rank
       WHERE domain=$1 AND as_of >= NOW() - make_interval(mins => $2)
       ORDER BY chatter_score DESC, last_seen DESC
       LIMIT 10`, [domain, win]
    );
    const top = rows.map((r, i) => ({
      rank: i+1,
      symbol: r.symbol,
      name: r.name,
      chatter_score: Number(r.chatter_score),
      reason: r.reason,
      last_seen: r.last_seen,
      evidence: r.evidence || []
    }));
    res.status(200).json({ domain, window_min: win, as_of: new Date().toISOString(), top });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
