begin;
create schema if not exists fca_private;
revoke all on schema fca_private from public,anon,authenticated;
create table fca_private.community_review_samples(
 game_hash bytea primary key check(octet_length(game_hash)=32),
 opening_uci varchar(120) not null check(opening_uci~'^(?:[a-h][1-8][a-h][1-8][qrbn]?){1,24}$'),
 result text not null check(result in('w','d','b')),
 time_class text not null check(time_class in('bullet','blitz','rapid','classical','unknown')),
 source_pool text not null check(source_pool in('chesscom','lichess','unknown')),
 white_rating smallint check(white_rating between 100 and 4000),black_rating smallint check(black_rating between 100 and 4000),
 rating_source text not null check(rating_source in('none','pgn_unverified')),
 white_accuracy_tenths smallint check(white_accuracy_tenths between 0 and 1000),
 black_accuracy_tenths smallint check(black_accuracy_tenths between 0 and 1000),
 white_estimate smallint check(white_estimate between 100 and 4000),black_estimate smallint check(black_estimate between 100 and 4000),
 white_moves smallint not null check(white_moves between 0 and 250),black_moves smallint not null check(black_moves between 0 and 250),
 white_blunders smallint not null check(white_blunders between 0 and 250),black_blunders smallint not null check(black_blunders between 0 and 250),
 white_mistakes smallint not null check(white_mistakes between 0 and 250),black_mistakes smallint not null check(black_mistakes between 0 and 250),
 white_inaccuracies smallint not null check(white_inaccuracies between 0 and 250),black_inaccuracies smallint not null check(black_inaccuracies between 0 and 250),
 white_chances_lost smallint not null check(white_chances_lost between 0 and 250),black_chances_lost smallint not null check(black_chances_lost between 0 and 250),
 engine_version text not null check(engine_version~'^19\.[0-9]+\.[0-9]+$'),
 engine_mode text not null check(engine_mode in('full','lite','economy')),analysis_depth smallint not null check(analysis_depth between 1 and 30),
 created_at timestamptz not null default now(),
 check((white_rating is null and black_rating is null) or rating_source='pgn_unverified')
);
comment on table fca_private.community_review_samples is 'Opt-in compact chess metrics. No PGNs, FENs, player names, usernames, URLs or full move lists.';
comment on column fca_private.community_review_samples.opening_uci is 'First 24 plies only. Full game is represented only by a keyed HMAC digest.';
comment on column fca_private.community_review_samples.rating_source is 'Ratings copied from PGN headers are unverified and not ground truth.';
create index community_review_samples_created_at_idx on fca_private.community_review_samples(created_at);
create index community_review_samples_opening_time_idx on fca_private.community_review_samples(opening_uci,time_class);
alter table fca_private.community_review_samples enable row level security;
revoke all on fca_private.community_review_samples from public,anon,authenticated;
create table fca_private.community_ingest_limits(
 window_day date not null,limit_kind text not null check(limit_kind in('client','network')),
 key_hash bytea not null check(octet_length(key_hash)=32),sample_count integer not null check(sample_count between 1 and 1000000),
 primary key(window_day,limit_kind,key_hash)
);
alter table fca_private.community_ingest_limits enable row level security;
revoke all on fca_private.community_ingest_limits from public,anon,authenticated;
create table fca_private.community_ingest_state(
 singleton boolean primary key default true check(singleton),sample_count integer not null default 0 check(sample_count between 0 and 100000),
 max_samples integer not null default 100000 check(max_samples=100000),last_pruned_day date not null default current_date
);
insert into fca_private.community_ingest_state(singleton) values(true) on conflict do nothing;
alter table fca_private.community_ingest_state enable row level security;
revoke all on fca_private.community_ingest_state from public,anon,authenticated;

create or replace function public.fca_ingest_community_reviews(p_client_hash bytea,p_network_hash bytea,p_samples jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_sample jsonb;v_hash text;v_limit integer;v_rows integer;v_count integer;v_max integer;v_pruned date;
 v_accepted integer:=0;v_dupes integer:=0;v_full boolean:=false;v_batch integer;
 v_day date:=(pg_catalog.now() at time zone 'UTC')::date;
 v_keys text[]:=array['game_hash','opening_uci','result','time_class','source_pool','white_rating','black_rating','rating_source',
 'white_accuracy_tenths','black_accuracy_tenths','white_estimate','black_estimate','white_moves','black_moves','white_blunders','black_blunders',
 'white_mistakes','black_mistakes','white_inaccuracies','black_inaccuracies','white_chances_lost','black_chances_lost','engine_version','engine_mode','analysis_depth'];
begin
 if p_client_hash is null or octet_length(p_client_hash)<>32 then raise exception 'Invalid client hash' using errcode='22023';end if;
 if p_network_hash is not null and octet_length(p_network_hash)<>32 then raise exception 'Invalid network hash' using errcode='22023';end if;
 if jsonb_typeof(p_samples) is distinct from 'array' then raise exception 'Invalid batch' using errcode='22023';end if;
 v_batch:=jsonb_array_length(p_samples);
 if v_batch<1 or v_batch>10 or octet_length(p_samples::text)>24000 then raise exception 'Batch limit exceeded' using errcode='22023';end if;
 for v_sample in select value from jsonb_array_elements(p_samples) loop
  if jsonb_typeof(v_sample) is distinct from 'object' or exists(select 1 from jsonb_object_keys(v_sample) as keys(k) where not(k=any(v_keys))) then
   raise exception 'Unexpected sample fields' using errcode='22023';end if;
  v_hash:=v_sample->>'game_hash';
  if coalesce(v_hash,'')!~'^[a-f0-9]{64}$'
   or coalesce(v_sample->>'opening_uci','')!~'^(?:[a-h][1-8][a-h][1-8][qrbn]?){1,24}$'
   or coalesce(v_sample->>'result','') not in('w','d','b')
   or coalesce(v_sample->>'time_class','') not in('bullet','blitz','rapid','classical','unknown')
   or coalesce(v_sample->>'source_pool','') not in('chesscom','lichess','unknown')
   or coalesce(v_sample->>'rating_source','') not in('none','pgn_unverified')
   or coalesce(v_sample->>'engine_version','')!~'^19\.[0-9]+\.[0-9]+$'
   or coalesce(v_sample->>'engine_mode','') not in('full','lite','economy') then raise exception 'Invalid metadata' using errcode='22023';end if;
  if (nullif(v_sample->>'white_rating','') is not null and (v_sample->>'white_rating')::int not between 100 and 4000)
   or (nullif(v_sample->>'black_rating','') is not null and (v_sample->>'black_rating')::int not between 100 and 4000)
   or (nullif(v_sample->>'white_estimate','') is not null and (v_sample->>'white_estimate')::int not between 100 and 4000)
   or (nullif(v_sample->>'black_estimate','') is not null and (v_sample->>'black_estimate')::int not between 100 and 4000)
   or (nullif(v_sample->>'white_accuracy_tenths','') is not null and (v_sample->>'white_accuracy_tenths')::int not between 0 and 1000)
   or (nullif(v_sample->>'black_accuracy_tenths','') is not null and (v_sample->>'black_accuracy_tenths')::int not between 0 and 1000)
   or coalesce((v_sample->>'analysis_depth')::int,0) not between 1 and 30 then raise exception 'Invalid numeric data' using errcode='22023';end if;
  if (nullif(v_sample->>'white_rating','') is not null or nullif(v_sample->>'black_rating','') is not null)
   and v_sample->>'rating_source'<>'pgn_unverified' then raise exception 'Unverified rating labels required' using errcode='22023';end if;
 end loop;
 select sample_count,max_samples,last_pruned_day into v_count,v_max,v_pruned from fca_private.community_ingest_state where singleton=true for update;
 if v_pruned<v_day then
  delete from fca_private.community_ingest_limits where window_day<v_day;
  delete from fca_private.community_review_samples where created_at<now()-interval '180 days';
  select count(*)::int into v_count from fca_private.community_review_samples;
  update fca_private.community_ingest_state set sample_count=v_count,last_pruned_day=v_day where singleton=true;
 end if;
 insert into fca_private.community_ingest_limits as limits(window_day,limit_kind,key_hash,sample_count)
 values(v_day,'client',p_client_hash,v_batch) on conflict(window_day,limit_kind,key_hash) do update set sample_count=least(1000000,limits.sample_count+excluded.sample_count)
 returning sample_count into v_limit;
 if v_limit>100 then return jsonb_build_object('accepted',0,'duplicates',0,'rate_limited',true);end if;
 if p_network_hash is not null then
  insert into fca_private.community_ingest_limits as limits(window_day,limit_kind,key_hash,sample_count)
  values(v_day,'network',p_network_hash,v_batch) on conflict(window_day,limit_kind,key_hash) do update set sample_count=least(1000000,limits.sample_count+excluded.sample_count)
  returning sample_count into v_limit;
  if v_limit>500 then return jsonb_build_object('accepted',0,'duplicates',0,'rate_limited',true);end if;
 end if;
 for v_sample in select value from jsonb_array_elements(p_samples) loop
  v_hash:=v_sample->>'game_hash';
  if exists(select 1 from fca_private.community_review_samples where game_hash=decode(v_hash,'hex')) then v_dupes:=v_dupes+1;continue;end if;
  if v_count>=v_max then v_full:=true;continue;end if;
  insert into fca_private.community_review_samples(game_hash,opening_uci,result,time_class,source_pool,white_rating,black_rating,rating_source,
   white_accuracy_tenths,black_accuracy_tenths,white_estimate,black_estimate,white_moves,black_moves,white_blunders,black_blunders,
   white_mistakes,black_mistakes,white_inaccuracies,black_inaccuracies,white_chances_lost,black_chances_lost,engine_version,engine_mode,analysis_depth)
  values(decode(v_hash,'hex'),v_sample->>'opening_uci',v_sample->>'result',v_sample->>'time_class',v_sample->>'source_pool',
   nullif(v_sample->>'white_rating','')::smallint,nullif(v_sample->>'black_rating','')::smallint,v_sample->>'rating_source',
   nullif(v_sample->>'white_accuracy_tenths','')::smallint,nullif(v_sample->>'black_accuracy_tenths','')::smallint,
   nullif(v_sample->>'white_estimate','')::smallint,nullif(v_sample->>'black_estimate','')::smallint,
   coalesce((v_sample->>'white_moves')::smallint,0),coalesce((v_sample->>'black_moves')::smallint,0),
   coalesce((v_sample->>'white_blunders')::smallint,0),coalesce((v_sample->>'black_blunders')::smallint,0),
   coalesce((v_sample->>'white_mistakes')::smallint,0),coalesce((v_sample->>'black_mistakes')::smallint,0),
   coalesce((v_sample->>'white_inaccuracies')::smallint,0),coalesce((v_sample->>'black_inaccuracies')::smallint,0),
   coalesce((v_sample->>'white_chances_lost')::smallint,0),coalesce((v_sample->>'black_chances_lost')::smallint,0),
   v_sample->>'engine_version',v_sample->>'engine_mode',(v_sample->>'analysis_depth')::smallint) on conflict(game_hash) do nothing;
  get diagnostics v_rows=row_count;
  if v_rows>0 then v_accepted:=v_accepted+1;v_count:=v_count+1;else v_dupes:=v_dupes+1;end if;
 end loop;
 update fca_private.community_ingest_state set sample_count=v_count where singleton=true;
 return jsonb_build_object('accepted',v_accepted,'duplicates',v_dupes,'capacity_reached',v_full,'remaining_capacity',greatest(0,v_max-v_count));
end;
$$;
revoke all on function public.fca_ingest_community_reviews(bytea,bytea,jsonb) from public,anon,authenticated;
grant execute on function public.fca_ingest_community_reviews(bytea,bytea,jsonb) to service_role;
commit;
