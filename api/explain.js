import { query } from './_lib/db.js';

export default async function handler(req, res){
  try{
    const url=new URL(req.url, `http://${req.headers.host}`);
    const domain=(url.searchParams.get('domain')||'stocks').toLowerCase();
    const symbol=(url.searchParams.get('symbol')||'').toUpperCase();

    if(!['stocks','crypto'].includes(domain)){
      res.status(400).json({error:'domain must be stocks or crypto'}); return;
    }
    if(!symbol){ res.status(400).json({error:'symbol required'}); return; }

    const rows=await query(
      `SELECT symbol,name,chatter_score,signals,evidence,last_seen,as_of
         FROM chatter_explain
        WHERE domain=$1 AND symbol=$2`,
      [domain,symbol]
    );

    if(!rows.length){ res.status(404).json({ error:'not found' }); return; }

    const r=rows[0];
    res.status(200).json({
      domain, symbol:r.symbol, name:r.name,
      chatter_score:Number(r.chatter_score),
      signals:r.signals||{}, evidence:r.evidence||[],
      last_seen:r.last_seen, as_of:r.as_of
    });
  }catch(e){
    res.status(500).json({ error:e?.message||String(e) });
  }
}
