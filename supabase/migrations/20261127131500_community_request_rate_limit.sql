-- Shared per-subnet request budget applied before expensive legal chess replay.
begin;

create table fca_private.community_ingest_request_limits(
 window_start timestamptz not null,
 network_hash bytea not null check(octet_length(network_hash)=32),
 request_count integer not null check(request_count between 1 and 16),
 primary key(window_start,network_hash)
);
alter table fca_private.community_ingest_request_limits enable row level security;
revoke all on fca_private.community_ingest_request_limits from public,anon,authenticated;
grant all on fca_private.community_ingest_request_limits to service_role;

create or replace function public.fca_consume_community_request(p_network_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_window timestamptz:=pg_catalog.date_trunc('minute',pg_catalog.clock_timestamp());
 v_count integer;
 v_retry integer;
begin
 if p_network_hash is null or pg_catalog.octet_length(p_network_hash)<>32 then
  raise exception 'Invalid network hash' using errcode='22023';
 end if;

 insert into fca_private.community_ingest_request_limits as limits(window_start,network_hash,request_count)
 values(v_window,p_network_hash,1)
 on conflict(window_start,network_hash) do update
 set request_count=least(limits.request_count+1,16)
 returning request_count into v_count;

 v_retry:=greatest(
  1,
  ceil(extract(epoch from (v_window+interval '1 minute'-pg_catalog.clock_timestamp())))::integer
 );

 return pg_catalog.jsonb_build_object(
  'allowed',v_count<=15,
  'remaining_requests',greatest(0,15-v_count),
  'retry_after_seconds',v_retry
 );
end;
$$;

revoke all on function public.fca_consume_community_request(bytea) from public,anon,authenticated;
grant execute on function public.fca_consume_community_request(bytea) to service_role;

-- Extend the existing scheduled cleanup so request-budget rows stay short-lived.
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

 delete from fca_private.community_ingest_request_limits
 where window_start < pg_catalog.now() - interval '1 day';

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

commit;
