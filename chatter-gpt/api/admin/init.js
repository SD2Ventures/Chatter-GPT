// One-time DB initializer; protect with ADMIN_INIT_TOKEN
import { query } from '../_lib/db.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  if (!process.env.ADMIN_INIT_TOKEN || token !== process.env.ADMIN_INIT_TOKEN) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  const ddl = await (await fetch(new URL('../_lib/schema.sql', import.meta.url))).text();
  try {
    await query(ddl);
    res.status(200).json({ ok: true, msg: 'Schema created/verified' });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
