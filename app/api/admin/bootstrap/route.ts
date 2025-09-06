import { db } from '@/lib/db';
import { ok, fail, requireToken } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-time bootstrap to create core tables/views from the cloud.
 * Call:  GET /api/admin/bootstrap?token=YOUR_ADMIN_INIT_TOKEN
 * Remove/disable after running.
 */
export async function GET(req: Request) {
  try {
    requireToken(req);
    const pool = db();

    await pool.query(`
      create table if not exists entities (
        id serial primary key,
        symbol text not null,
        kind text check (kind in ('stock','crypto')) not null,
        name text,
        unique(symbol, kind)
      );

      create table if not exists mentions (
        id bigserial primary key,
        entity_id int not null references entities(id) on delete cascade,
        source text check (source in ('reddit','news','sec','pr','x','stocktwits')) not null,
        domain text,
        url text,
        title text,
        body text,
        author_hash text,
        sentiment numeric,
        published_at timestamptz not null default now(),
        dedupe_key text,
        unique(dedupe_key)
      );
      create index if not exists idx_mentions_entity_time on mentions(entity_id, published_at desc);

      create table if not exists events (
        id bigserial primary key,
        entity_id int not null references entities(id) on delete cascade,
        event_type text not null,
        title text,
        summary text,
        url text,
        source text,
        published_at timestamptz not null default now(),
        confidence numeric
      );
      create index if not exists idx_events_entity_time on events(entity_id, published_at desc);

      create or replace view v_chatter_basic as
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
      select c.entity_id,
             (c.v60 - b.mu)/nullif(b.sigma,0) as z,
             (c.v60 - c.v15) as velocity,
             greatest(0, coalesce((c.v60 - b.mu)/nullif(b.sigma,0),0))
               + 0.3 * greatest(0, coalesce((c.v60 - c.v15),0)) as chatter_score
      from cur c
      left join base b using(entity_id)
      order by chatter_score desc;
    `);

    return ok({ created: true });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
