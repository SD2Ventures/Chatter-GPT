import { query } from '../_lib/db.js';
import { extractCashtags, isCrypto, prettyName, scoreFromZ } from '../_lib/util.js';
const SOURCE = 'reddit';

function subList(domain){
  return (domain==='crypto'
    ? (process.env.SUBS_CRYPTO||'cryptocurrency+bitcoin+ethfinance+solana')
    : (process.env.SUBS_STOCKS||'stocks+wallstreetbets+investing')
  ).split('+');
}

async function getToken(){
  const id=process.env.REDDIT_CLIENT_ID, secret=process.env.REDDIT_SECRET, user=process.env.REDDIT_USERNAME, pass=process.env.REDDIT_PASSWORD;
  const ua=process.env.REDDIT_USER_AGENT || 'chatter-live/1.0 by yourname';
  if(!(id&&secret&&user&&pass)) throw new Error('Missing Reddit credentials');
  const headers={
    'Authorization':'Basic '+Buffer.from(`${id}:${secret}`).toString('base64'),
    'Content-Type':'application/x-www-form-urlencoded',
    'User-Agent':ua
  };
  const body=new URLSearchParams({ grant_type:'password', username:user, password:pass });
  const r=await fetch('https://www.reddit.com/api/v1/access_token',{method:'POST',headers,body});
  if(!r.ok) throw new Error('Reddit token error '+r.status+' '+await r.text());
  const j=await r.json(); return { token:j.access_token, ua };
}

async function fetchNewPosts(sub, token, ua){
  const r=await fetch(`https://oauth.reddit.com/r/${sub}/new.json?limit=100`,{
    headers:{ 'Authorization':`bearer ${token}`,'User-Agent':ua }
  });
  if(!r.ok) throw new Error('Reddit fetch error '+r.status+' '+await r.text());
  const j=await r.json(); return (j.data?.children||[]).map(c=>c.data);
}

function evidenceFromPost(p){ return `https://www.reddit.com${p.permalink}`; }
function domainFilter(domain, sym){ return domain==='crypto' ? isCrypto(sym) : !isCrypto(sym); }

async function upsert(domain, counts, evidences){
  const alpha=parseFloat(process.env.EMA_ALPHA||'0.2');
  const now=new Date().toISOString();

  for (const [sym, cnt] of counts){
    const prev=await query(`SELECT ema_count FROM ticker_stats WHERE domain=$1 AND symbol=$2`,[domain,sym]);
    const prevEma=prev.length?parseFloat(prev[0].ema_count):null;
    const newEma=(prevEma===null)?cnt:(alpha*cnt+(1-alpha)*prevEma);
    const z=(cnt-(prevEma??cnt))/Math.sqrt(Math.max(prevEma??cnt,1));

    const evidenceLinks=(evidences.get(sym)||[]).slice(0,3);
    const score=scoreFromZ(z, evidenceLinks.length, 0);
    const reason=`${cnt} new mentions vs baseline ${(prevEma??cnt).toFixed(1)}`;
    const name=prettyName(domain, sym);

    await query(
      `INSERT INTO ticker_stats(domain,symbol,ema_count,updated_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (domain,symbol)
       DO UPDATE SET ema_count=EXCLUDED.ema_count, updated_at=EXCLUDED.updated_at`,
       [domain,sym,newEma,now]
    );

    await query(
      `INSERT INTO chatter_rank(domain,symbol,name,chatter_score,reason,last_seen,evidence,as_of)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (domain, symbol)
       DO UPDATE SET chatter_score=EXCLUDED.chatter_score,
                     reason=EXCLUDED.reason,
                     last_seen=EXCLUDED.last_seen,
                     evidence=EXCLUDED.evidence,
                     as_of=EXCLUDED.as_of`,
       [domain,sym,name,score,reason,now,JSON.stringify(evidenceLinks),now]
    );

    const signals={chatter_z:z,sources:1,event:null};
    await query(
      `INSERT INTO chatter_explain(domain,symbol,name,chatter_score,signals,evidence,last_seen,as_of)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (domain, symbol)
       DO UPDATE SET chatter_score=EXCLUDED.chatter_score,
                     signals=EXCLUDED.signals,
                     evidence=EXCLUDED.evidence,
                     last_seen=EXCLUDED.last_seen,
                     as_of=EXCLUDED.as_of`,
       [domain,sym,name,score,JSON.stringify(signals),JSON.stringify(evidenceLinks),now,now]
    );
  }
}

export default async function handler(req,res){
  try{
    const url=new URL(req.url, `http://${req.headers.host}`);
    const domain=(url.searchParams.get('domain')||'stocks').toLowerCase();
    if(!['stocks','crypto'].includes(domain)) { res.status(400).json({error:'domain must be stocks or crypto'}); return; }

    const {token, ua}=await getToken();
    const subs=subList(domain);
    const counts=new Map(); const evidences=new Map(); const seen=new Set();

    for (const sub of subs){
      const posts=await fetchNewPosts(sub, token, ua);
      for (const p of posts){
        const pid=p.name; if(seen.has(pid)) continue; seen.add(pid);
        try{ await query(`INSERT INTO posts_ingested(source, post_id) VALUES ($1,$2)`,[SOURCE,pid]); } catch { continue; }
        const syms=extractCashtags(`${p.title||''}\n${p.selftext||''}`); if(!syms.length) continue;
        for (const s of syms){
          if(!domainFilter(domain,s)) continue;
          counts.set(s,(counts.get(s)||0)+1);
          const arr=evidences.get(s)||[]; if(arr.length<5) arr.push(evidenceFromPost(p)); evidences.set(s,arr);
        }
      }
    }

    if (counts.size === 0) { res.status(204).end(); return; }
    await upsert(domain, counts, evidences);
    res.status(204).end();
  } catch(e){
    res.status(500).json({ error:e?.message||String(e) });
  }
}
