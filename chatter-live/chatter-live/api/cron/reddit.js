// Runs every minute per domain to ingest new Reddit posts from target subreddits.
// ENV required:
//   REDDIT_CLIENT_ID, REDDIT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD, REDDIT_USER_AGENT
//   SUBS_STOCKS (e.g., "stocks+wallstreetbets+investing")
//   SUBS_CRYPTO (e.g., "cryptocurrency+bitcoin+ethfinance+solana")
//   EMA_ALPHA (optional, default 0.2)

import { query } from '../_lib/db.js';
import { extractCashtags, isCrypto, prettyName, scoreFromZ } from '../_lib/util.js';

const SOURCE = 'reddit';

function subList(domain) {
  if (domain === 'crypto') return (process.env.SUBS_CRYPTO || 'cryptocurrency+bitcoin+ethfinance+solana').split('+');
  return (process.env.SUBS_STOCKS || 'stocks+wallstreetbets+investing').split('+');
}

async function getToken() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  const ua = process.env.REDDIT_USER_AGENT || 'chatter-live/1.0 by yourname';

  if (!(id && secret && username && password)) {
    throw new Error('Missing Reddit credentials');
  }
  const headers = {
    'Authorization': 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': ua
  };
  const body = new URLSearchParams({
    grant_type: 'password',
    username, password
  });
  const resp = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST', headers, body
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error('Reddit token error: ' + resp.status + ' ' + t);
  }
  const j = await resp.json();
  return { token: j.access_token, ua };
}

async function fetchNewPosts(sub, token, ua) {
  const url = `https://oauth.reddit.com/r/${sub}/new.json?limit=100`;
  const resp = await fetch(url, {
    headers: { 'Authorization': `bearer ${token}`, 'User-Agent': ua }
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error('Reddit fetch error: ' + resp.status + ' ' + t);
  }
  const j = await resp.json();
  return (j.data?.children || []).map(c => c.data);
}

function evidenceFromPost(p) {
  return `https://www.reddit.com${p.permalink}`;
}

function domainFilter(domain, sym) {
  if (domain === 'crypto') return isCrypto(sym);
  // stocks domain: exclude known crypto
  return !isCrypto(sym);
}

async function upsertStatsAndScores(domain, counts, evidences) {
  const alpha = parseFloat(process.env.EMA_ALPHA || '0.2');
  const now = new Date().toISOString();

  for (const [sym, cnt] of counts) {
    // Get prev EMA
    const prev = await query(`SELECT ema_count FROM ticker_stats WHERE domain=$1 AND symbol=$2`, [domain, sym]);
    const prevEma = prev.length ? parseFloat(prev[0].ema_count) : null;
    const newEma = (prevEma === null) ? cnt : (alpha*cnt + (1-alpha)*prevEma);
    const z = (cnt - (prevEma ?? cnt)) / Math.sqrt(Math.max(prevEma ?? cnt, 1));
    const evidenceLinks = (evidences.get(sym) || []).slice(0,3);
    const eventBoost = 0; // optional: integrate SEC boost by symbol
    const score = scoreFromZ(z, evidenceLinks.length, eventBoost);
    const reason = `${cnt} new mentions vs baseline ${((prevEma ?? cnt)).toFixed(1)}`;
    const name = prettyName(domain, sym);

    // Upsert stats
    await query(
      `INSERT INTO ticker_stats(domain, symbol, ema_count, updated_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (domain, symbol) DO UPDATE
         SET ema_count=EXCLUDED.ema_count, updated_at=EXCLUDED.updated_at`,
      [domain, sym, newEma, now]
    );

    // Upsert rank
    await query(
      `INSERT INTO chatter_rank(domain, symbol, name, chatter_score, reason, last_seen, evidence, as_of)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (domain, symbol) DO UPDATE
         SET chatter_score=EXCLUDED.chatter_score,
             reason=EXCLUDED.reason,
             last_seen=EXCLUDED.last_seen,
             evidence=EXCLUDED.evidence,
             as_of=EXCLUDED.as_of`,
      [domain, sym, name, score, reason, now, JSON.stringify(evidenceLinks), now]
    );

    // Upsert explain
    const signals = { chatter_z: z, sources: 1, event: null };
    await query(
      `INSERT INTO chatter_explain(domain, symbol, name, chatter_score, signals, evidence, last_seen, as_of)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (domain, symbol) DO UPDATE
         SET chatter_score=EXCLUDED.chatter_score,
             signals=EXCLUDED.signals,
             evidence=EXCLUDED.evidence,
             last_seen=EXCLUDED.last_seen,
             as_of=EXCLUDED.as_of`,
      [domain, sym, name, score, JSON.stringify(signals), JSON.stringify(evidenceLinks), now, now]
    );
  }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const domain = (url.searchParams.get('domain') || 'stocks').toLowerCase();
    if (!['stocks','crypto'].includes(domain)) {
      res.status(400).json({ error: 'domain must be stocks or crypto' });
      return;
    }

    const { token, ua } = await getToken();
    const subs = subList(domain);
    const counts = new Map(); // symbol -> count
    const evidences = new Map(); // symbol -> [links]
    const seenIds = new Set();

    for (const sub of subs) {
      const posts = await fetchNewPosts(sub, token, ua);
      for (const p of posts) {
        const pid = p.name; // e.g., t3_xxxxxx
        if (seenIds.has(pid)) continue;
        seenIds.add(pid);

        // dedupe by DB primary key
        try {
          await query(`INSERT INTO posts_ingested(source, post_id) VALUES ($1,$2)`, [SOURCE, pid]);
        } catch { continue; } // already seen

        const text = `${p.title || ''}\n${p.selftext || ''}`;
        const syms = extractCashtags(text);
        if (!syms.length) continue;

        for (const s of syms) {
          if (!domainFilter(domain, s)) continue;
          counts.set(s, (counts.get(s) || 0) + 1);
          const link = evidenceFromPost(p);
          const arr = evidences.get(s) || [];
          if (arr.length < 5) arr.push(link);
          evidences.set(s, arr);
        }
      }
    }

    await upsertStatsAndScores(domain, counts, evidences);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
