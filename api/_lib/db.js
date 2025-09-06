// Neon serverless SQL client
import { neon } from '@neondatabase/serverless';
export const sql = neon(process.env.DATABASE_URL);
export async function query(q, params = []) {
  return await sql(q, params);
}
