import { query } from "./_lib/db.js";
import { rankSymbols } from "./_lib/rank.js";

export default async function handler(req,res){
  try{
    const since = (req.query.since || "24h").toLowerCase();
    const limit = Math.min(parseInt(req.query.limit||"100",10), 300);
    const halfLifeH = parseInt(req.query.halflife || "24", 10);

    const interval =
      since.endsWith("h") ? `${since.slice(0,-1)} hours` :
      since.endsWith("w") ? `${+since.slice(0,-1)*7} days` :
      `${since.replace(/[^0-9]/g,"")} days`;

    const { rows } = await query(
      `SELECT m.symbol,
              COUNT(*)::int AS mentions,
              SUM(m.engagement)::int AS engagement,
              MAX(m.created_utc) AS latest_ts
       FROM mentions m
       WHERE m.created_utc >= NOW() - INTERVAL '${interval}'
       GROUP BY m.symbol`
    );

    const ranked = rankSymbols(rows, { halfLifeH });
    res.status(200).json({ since, results: ranked.slice(0, limit) });
  }catch(e){
    console.error(e);
    res.status(500).json({ ok:false, error:String(e) });
  }
}
