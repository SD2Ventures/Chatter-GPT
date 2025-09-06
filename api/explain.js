import { query } from "./_lib/db.js";

export default async function handler(req,res){
  try{
    const symbol = (req.query.symbol||"").toUpperCase();
    const since = req.query.since || "7d";
    if (!symbol) return res.status(400).json({ error:"symbol is required" });

    const interval =
      since.endsWith("h") ? `${since.slice(0,-1)} hours` :
      since.endsWith("w") ? `${+since.slice(0,-1)*7} days` :
      `${since.replace(/[^0-9]/g,"")} days`;

    const { rows } = await query(
      `SELECT p.external_id, p.url, p.title, p.author, p.channel, p.created_utc, p.score, p.num_comments
       FROM posts_ingested p
       JOIN mentions m ON m.external_id = p.external_id
       WHERE m.symbol=$1 AND m.created_utc >= NOW() - INTERVAL '${interval}'
       ORDER BY p.created_utc DESC
       LIMIT 200`,
      [symbol]
    );

    res.status(200).json({ symbol, since, posts: rows });
  }catch(e){
    console.error(e);
    res.status(500).json({ ok:false, error:String(e) });
  }
}
