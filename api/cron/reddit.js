import { query } from "../_lib/db.js";
import { extractSymbols } from "../_lib/extract.js";
import { getRedditToken, redditHeaders } from "../_lib/redditAuth.js";

// Autonomous coverage: major stock + crypto subs
const SUBS = [
  "stocks","wallstreetbets","investing","StockMarket","options","pennystocks",
  "valueinvesting","smallstreetbets",
  "CryptoCurrency","Bitcoin","ethtrader","CryptoMarkets","CryptoCurrencyTrading"
];

// --- OAuth-backed fetch wrapper ---
async function fetchJSON(url) {
  const token = await getRedditToken();
  const res = await fetch(url, { headers: redditHeaders(token) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch ${res.status} ${url} :: ${text.slice(0,200)}`);
  }
  return res.json();
}

// Normalize listing item -> lightweight post object
function normalizeListingItem(item, sub) {
  const d = item.data || {};
  return {
    external_id: d.id,
    permalink: d.permalink, // keep for comments fetch
    url: d.url_overridden_by_dest || `https://www.reddit.com${d.permalink}`,
    title: d.title || "",
    author: d.author || "",
    channel: sub,
    created_utc: new Date((d.created_utc || d.created) * 1000).toISOString(),
    score: d.score ?? 0,
    num_comments: d.num_comments ?? 0,
    selftext: d.selftext || ""
  };
}

// Pull a post's comment tree (top-level + some replies) -> concatenated text
async function fetchComments(permalink) {
  if (!permalink) return "";
  const url = `https://oauth.reddit.com${permalink}.json?limit=200`;
  const data = await fetchJSON(url);
  const out = [];
  if (Array.isArray(data) && data[1]?.data?.children) {
    for (const c of data[1].data.children) {
      const cd = c?.data;
      if (cd?.body) out.push(cd.body);
      // include 1-level replies for more signal (optional)
      if (cd?.replies?.data?.children) {
        for (const r of cd.replies.data.children) {
          const rd = r?.data;
          if (rd?.body) out.push(rd.body);
        }
      }
    }
  }
  return out.join(" ");
}

async function upsertRedditPost(post, fulltext, symbols) {
  // Upsert into posts_ingested
  await query(
    `INSERT INTO posts_ingested
       (source, external_id, url, title, author, channel, created_utc, score, num_comments, fulltext, symbols)
     VALUES
       ('reddit', $1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (external_id) DO UPDATE
       SET score=EXCLUDED.score,
           num_comments=EXCLUDED.num_comments,
           fulltext=EXCLUDED.fulltext,
           symbols=EXCLUDED.symbols`,
    [
      post.external_id, post.url, post.title, post.author, post.channel,
      post.created_utc, post.score, post.num_comments, fulltext, symbols
    ]
  );

  // Mentions upsert (engagement = score + comments)
  const engagement = (post.score || 0) + (post.num_comments || 0);
  for (const s of symbols) {
    await query(
      `INSERT INTO mentions (external_id, symbol, count, created_utc, source, engagement)
       VALUES ($1,$2,1,$3,'reddit',$4)
       ON CONFLICT (external_id, symbol)
       DO UPDATE SET count = mentions.count + 1,
                     engagement = mentions.engagement + $4`,
      [post.external_id, s, post.created_utc, engagement]
    );
  }
}

export default async function handler(req, res) {
  try {
    // Tuning knobs via query (optional)
    const limitPerSub = Math.min(parseInt(req.query.limit || "50", 10), 100);
    const includeComments = req.query.comments === "0" ? false : true; // default true
    const subs = (req.query.subreddits || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    const LIST = subs.length ? subs : SUBS;

    let processed = 0;

    for (const sub of LIST) {
      // Use OAuth base domain
      const url = `https://oauth.reddit.com/r/${sub}/new?limit=${limitPerSub}`;
      const listing = await fetchJSON(url);
      const children = listing?.data?.children || [];

      for (const child of children) {
        const post = normalizeListingItem(child, sub);
        const baseText = `${post.title}\n${post.selftext}`.trim();
        const commentsText = includeComments
          ? await fetchComments(post.permalink)
          : "";
        const fulltext = `${baseText}\n${commentsText}`.trim();

        const symbols = extractSymbols(fulltext);
        if (symbols.length === 0) continue;

        await upsertRedditPost(post, fulltext, symbols);
        processed++;
      }

      // Courtesy delay per subreddit to play nice with rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    res.status(200).json({ ok: true, processed, subs: LIST.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
}
