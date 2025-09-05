// Optional: fetch latest SEC filings (every 5m) and store event URLs to boost scores later.
// Uses official public RSS/Atom "Latest Filings" and company_tickers.json mapping for ticker resolution.
import { query } from '../_lib/db.js';

const UA = process.env.SEC_UA || 'chatter-live/1.0 (your-email@example.com)';

async function fetchText(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error(`SEC fetch ${url} -> ${resp.status}`);
  return await resp.text();
}

export default async function handler(req, res) {
  try {
    const atom = await fetchText('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&output=atom');
    // Placeholder no-op to keep serverless quick; extend to parse and map tickers for event boosts.
    await query('SELECT 1');
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
