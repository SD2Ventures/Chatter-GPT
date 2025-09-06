import { query } from "../_lib/db.js";
import { extractSymbols } from "../_lib/extract.js";

const SUBS = [
  "stocks","wallstreetbets","investing","StockMarket","options","pennystocks",
  "valueinvesting","smallstreetbets","CryptoCurrency","Bitcoin","ethtrader",
  "CryptoMarkets","CryptoCurrencyTrading"
];

const UA = "Mozilla/5.0 (OmniChatter/1.0; +https://vercel.app)";

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Fetch ${r.status} ${url}`);
  return r.json();
}

function norm(item, sub) {
  const d = item.data;
  return {
    external_id: d.id,
    url: `https://www.reddit.com${d.permalink}`,
    title: d.title || "",
    author: d.author || "",
    channel: sub,
    created_utc: new Date(d.created_utc * 1000).toISOString(),
    score: d.score ?? 0,
    num_comments: d.num_comments ?? 0,
    selftext: d.selftext || ""
  };
}

async function fetchComments(permalink) {
  const url = `https://www.reddit.com${permalink}.json?limit=200`;
  const data = await fetchJSON(url);
  const parts = [];
  if (Array.isArray(data) && data[1]?.data?.children) {
    for (const c of data[1].data.children) {
      const cd = c.data;
      if (cd?.body) parts.push(cd.body);
    }
  }
  return parts.join(" ");
}

async function upsert(post, fulltext, symbols) {
  await query(
    `INSERT INTO posts_ingested (source, external_id, url, title, author, channel, created_utc, score, num_comments, fulltext, symbols)
     VALUES ('reddit',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (external_id) DO UPDATE
       SET score=EXCLUDED.score, num_comments=EXCLUDED.num_comments, fulltext=EXCLUDED.fulltext, symbols=EXCLUDED.symbols`,
    [post.external_id, post.url, post.title, post.author, post.channel, post.created_utc, post.score, post.num_comments, fulltext, symbols]
  );

  const engagement = (post.score||0) + (post.num_comments||0);
  for (const s of symbols) {
    await query(
      `INSERT INTO mentions (external_id, symbol, count, created_utc, source, engagement)
       VALUES ($1,$2,1,$3,'reddit',$4)
       ON CONFLICT (external_id, symbol) DO UPDATE SET count=mentions.count+1, engagement=mentions.engagement+$4`,
      [post.external_id, s, post.created_utc, engagement]
    );
  }
}

export default async function handler(req,res){
  try{
    const limit = Math.min(parseInt(req.query.limit||"50",10), 100);
    let processed = 0;

    for (const sub of SUBS) {
      const list = await fetchJSON(`https://www.reddit.com/r/${sub}/new.json?limit=${limit}`);
      const posts = (list.data.children||[]).map(c => norm(c, sub));
      for (const p of posts) {
        const comments = await fetchComments(p.url.replace("https://www.reddit.com",""));
        const fulltext = `${p.title}\n${p.selftext}\n${comments}`.trim();
        const symbols = extractSymbols(fulltext);
        if (symbols.length === 0) continue;
        await upsert(p, fulltext, symbols);
        processed++;
      }
      await new Promise(r=>setTimeout(r, 400)); // small courtesy delay
    }

    res.status(200).json({ ok:true, processed, subs: SUBS.length });
  }catch(e){
    console.error(e);
    res.status(500).json({ ok:false, error:String(e) });
  }
}
