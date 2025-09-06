import { Pool } from "pg";

const { DATABASE_URL } = process.env;

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 4,
  ssl: /neon\.tech|supabase\.co|vercel-postgres\.com/.test(DATABASE_URL || "")
    ? { rejectUnauthorized: false }
    : undefined
});

export async function query(q, params = []) {
  const c = await pool.connect();
  try { return await c.query(q, params); }
  finally { c.release(); }
}
