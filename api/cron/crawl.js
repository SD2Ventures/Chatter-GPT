import crypto from "node:crypto";
import { visibleText } from "../_lib/html.js";
import { extractSymbols } from "../_lib/extract.js";
import { query } from "../_lib/db.js";

const UA = "Mozilla/5.0 (OmniChatter/1.0)";

function hash(str){ return crypto.createHash("sha256").update(str).digest("hex").slice(0,32); }

export default async function handler(req,res){
  try{
    const url = req.query.url;
    if(!url) return res.status(400).json({ error:"url is required" });

    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if(!r.ok) return res.status(502).json({ ok:false, error:`Fetch ${r.status}` });

    const html = await r.text();
    const text = visibleText(html);
    const symbols = extractSymbols(text);
    const external_id = hash(url);

    await query(
      `INSERT INTO posts_ingested (source, external_id, url, title, channel, created_utc, fulltext, symbols)
       VALUES ('web',$1,$2,$3,$4,NOW(),$5,$6)
       ON CONFLICT (external_id) DO UPDATE SET title=EXCLUDED.title, fulltext=EXCLUDED.fulltext, symbols=EXCLUDED.symbols`,
      [external_id, url, url, "web", text, symbols]
    );
    for (const s of symbols) {
      await query(
        `INSERT INTO mentions (external_id, symbol, count, created_utc, source, engagement)
         VALUES ($1,$2,1,NOW(),'web',1)
         ON CONFLICT (external_id, symbol) DO UPDATE SET count=mentions.count+1, engagement=mentions.engagement+1`,
        [external_id, s]
      );
    }

    res.status(200).json({ ok:true, url, symbols, length: text.length });
  }catch(e){
    console.error(e);
    res.status(500).json({ ok:false, error:String(e) });
  }
}
