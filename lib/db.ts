import { Pool } from 'pg';

let _pool: Pool | undefined;

export function db() {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });
  return _pool;
}
