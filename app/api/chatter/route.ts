import { db } from '@/lib/db';
import { ok, fail } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = db();
    const { rows } = await pool.query(`
      with cur as (
        select entity_id,
               count(*) filter (where published_at >= now() - interval '15 minutes') as v15,
               count(*) filter (where published_at >= now() - interval '60 minutes') as v60
        from mentions
        where published_at >= now() - interval '60 minutes'
        group by 1
      ),
      base as (
        select entity_id, avg(cnt) as mu, stddev_pop(cnt) as sigma
        from (
          select entity_id, date_trunc('hour', published_at) hr, count(*) cnt
          from mentions
          where published_at >= now() - interval '30 days'
          group by 1,2
        ) s
        group by 1
      )
      select e.symbol,
             e.kind,
             coalesce(((c.v60 - b.mu) / nullif(b.sigma,0)), 0) as z,
             coalesce((c.v60 - c.v15), 0) as velocity,
             greatest(0, coalesce(((c.v60 - b.mu) / nullif(b.sigma,0)),0))
               + 0.3 * greatest(0, coalesce((c.v60 - c.v15),0)) as chatter_score
      from entities e
      join cur c on c.entity_id = e.id
      left join base b on b.entity_id = e.id
      order by chatter_score desc
      limit 25;
    `);

    return ok({ asOf: new Date().toISOString(), window: '1h', top: rows });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
