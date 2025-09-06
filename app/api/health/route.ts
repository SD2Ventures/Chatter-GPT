import { db } from '@/lib/db';
import { ok, fail } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = db();
    const { rows } = await pool.query(`
      with m as (
        select count(*)::int as c
        from mentions
        where published_at > now() - interval '1 hour'
      ),
      e as (
        select count(*)::int as c
        from events
        where published_at > now() - interval '1 hour'
      )
      select (select c from m) as mentions_1h,
             (select c from e) as events_1h,
             now() as at
    `);
    return ok(rows[0]);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
