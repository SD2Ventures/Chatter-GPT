// Neon serverless SQL client (ideal for Vercel)
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

// Simple helper: run a query with positional params
export async function query(q, params=[]) {
  return await sql(q, params);
}
