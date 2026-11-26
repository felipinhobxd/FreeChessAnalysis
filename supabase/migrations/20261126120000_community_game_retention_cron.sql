begin;

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function fca_private.prune_community_game_samples()
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
 v_count integer;
 v_day date:=(pg_catalog.now() at time zone 'UTC')::date;
begin
 delete from fca_private.community_game_samples
 where created_at < pg_catalog.now() - interval '180 days';

 delete from fca_private.community_ingest_limits
 where window_day < v_day;

 select pg_catalog.count(*)::integer
 into v_count
 from fca_private.community_game_samples;

 update fca_private.community_game_ingest_state
 set sample_count=v_count,last_pruned_day=v_day
 where singleton=true;
end;
$$;

revoke all on function fca_private.prune_community_game_samples() from public,anon,authenticated,service_role;
grant execute on function fca_private.prune_community_game_samples() to postgres;

select cron.schedule(
 'community-game-samples-retention',
 '17 4 * * *',
 'select fca_private.prune_community_game_samples();'
);

commit;
