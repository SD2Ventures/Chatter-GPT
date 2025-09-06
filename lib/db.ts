import { Pool } from 'pg';

let _pool: Pool | undefined;

export function db() {
  if (_pool) return _pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Neon/Supabase friendly; Vercel sets SSL automatically but this is safe:
    ssl: { rejectUnauthorized: false }
  });
  return _pool;
}
