begin;

create table fca_private.community_game_samples(
 game_hash bytea primary key check(octet_length(game_hash)=32),
 opening_uci varchar(120) not null check(opening_uci~'^(?:[a-h][1-8][a-h][1-8][qrbn]?){1,24}$'),
 moves_uci varchar(3000) not null check(moves_uci~'^(?:[a-h][1-8][a-h][1-8][qrbn]?)(?:\.(?:[a-h][1-8][a-h][1-8][qrbn]?)){7,499}$'),
 ply_count smallint not null check(ply_count between 8 and 500),
 start_fen varchar(100) check(start_fen is null or start_fen~'^[prnbqkPRNBQK1-8/]+ [wb] (?:-|[KQkq]{1,4}) (?:-|[a-h][36]) [0-9]+ [0-9]+$'),
 move_data bytea not null check(octet_length(move_data)=ply_count*10),
 result text not null check(result in('w','d','b')),
 time_class text not null check(time_class in('bullet','blitz','rapid','classical','unknown')),
 source_pool text not null check(source_pool in('chesscom','lichess','unknown')),
 white_rating smallint check(white_rating between 100 and 4000),
 black_rating smallint check(black_rating between 100 and 4000),
 rating_source text not null check(rating_source in('none','pgn_unverified')),
 white_accuracy_tenths smallint check(white_accuracy_tenths between 0 and 1000),
 black_accuracy_tenths smallint check(black_accuracy_tenths between 0 and 1000),
 white_estimate smallint check(white_estimate between 100 and 4000),
 black_estimate smallint check(black_estimate between 100 and 4000),
 white_moves smallint not null check(white_moves between 0 and 250),
 black_moves smallint not null check(black_moves between 0 and 250),
 white_blunders smallint not null check(white_blunders between 0 and 250),
 black_blunders smallint not null check(black_blunders between 0 and 250),
 white_mistakes smallint not null check(white_mistakes between 0 and 250),
 black_mistakes smallint not null check(black_mistakes between 0 and 250),
 white_inaccuracies smallint not null check(white_inaccuracies between 0 and 250),
 black_inaccuracies smallint not null check(black_inaccuracies between 0 and 250),
 white_chances_lost smallint not null check(white_chances_lost between 0 and 250),
 black_chances_lost smallint not null check(black_chances_lost between 0 and 250),
 engine_version text not null check(engine_version~'^19\.[0-9]+\.[0-9]+$'),
 engine_mode text not null check(engine_mode in('full','lite','economy')),
 analysis_depth smallint not null check(analysis_depth between 1 and 30),
 created_at timestamptz not null default now(),
 check((white_rating is null and black_rating is null) or rating_source='pgn_unverified')
);

comment on table fca_private.community_game_samples is
 'Opt-in full-game community dataset. Stores UCI move sequence and compact 10-byte per-ply analysis records; no PGN headers, player names, usernames or URLs.';
comment on column fca_private.community_game_samples.moves_uci is
 'Complete mainline move sequence in UCI, separated by periods. No SAN, comments, PGN headers or player identifiers.';
comment on column fca_private.community_game_samples.start_fen is
 'Only set when the game starts from a non-standard position; contains chess position state, not player identity.';
comment on column fca_private.community_game_samples.move_data is
 'Exactly 10 bytes per ply: before/after signed centipawn scores, accuracy tenths, classification id, flags and packed best-move UCI.';

create index community_game_samples_created_at_idx on fca_private.community_game_samples(created_at);
create index community_game_samples_opening_time_idx on fca_private.community_game_samples(opening_uci,time_class);

grant usage on schema fca_private to service_role;
alter table fca_private.community_game_samples enable row level security;
revoke all on fca_private.community_game_samples from public,anon,authenticated;
grant all on fca_private.community_game_samples to service_role;

create table fca_private.community_game_ingest_state(
 singleton boolean primary key default true check(singleton),
 sample_count integer not null default 0 check(sample_count between 0 and 50000),
 max_samples integer not null default 50000 check(max_samples=50000),
 last_pruned_day date not null default current_date
);
insert into fca_private.community_game_ingest_state(singleton) values(true) on conflict do nothing;
alter table fca_private.community_game_ingest_state enable row level security;
revoke all on fca_private.community_game_ingest_state from public,anon,authenticated;
grant all on fca_private.community_game_ingest_state to service_role;

create or replace function public.fca_ingest_community_games(
 p_client_hash bytea,p_network_hash bytea,p_samples jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_sample jsonb;
 v_hash text;
 v_move_array text[];
 v_ply_count integer;
 v_move_data bytea;
 v_limit integer;
 v_rows integer;
 v_count integer;
 v_max integer;
 v_pruned date;
 v_accepted integer:=0;
 v_dupes integer:=0;
 v_full boolean:=false;
 v_batch integer;
 v_new_requested integer;
 v_day date:=(pg_catalog.now() at time zone 'UTC')::date;
 v_keys text[]:=array[
  'game_hash','opening_uci','moves_uci','ply_count','start_fen','move_data_base64',
  'result','time_class','source_pool','white_rating','black_rating','rating_source',
  'white_accuracy_tenths','black_accuracy_tenths','white_estimate','black_estimate',
  'white_moves','black_moves','white_blunders','black_blunders','white_mistakes','black_mistakes',
  'white_inaccuracies','black_inaccuracies','white_chances_lost','black_chances_lost',
  'engine_version','engine_mode','analysis_depth'
 ];
begin
 if p_client_hash is null or octet_length(p_client_hash)<>32 then
  raise exception 'Invalid client hash' using errcode='22023';
 end if;
 if p_network_hash is not null and octet_length(p_network_hash)<>32 then
  raise exception 'Invalid network hash' using errcode='22023';
 end if;
 if jsonb_typeof(p_samples) is distinct from 'array' then
  raise exception 'Invalid batch' using errcode='22023';
 end if;
 v_batch:=jsonb_array_length(p_samples);
 if v_batch<1 or v_batch>5 or octet_length(p_samples::text)>131072 then
  raise exception 'Batch limit exceeded' using errcode='22023';
 end if;

 for v_sample in select value from jsonb_array_elements(p_samples) loop
  if jsonb_typeof(v_sample) is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(v_sample) as keys(k) where not(k=any(v_keys))) then
   raise exception 'Unexpected sample fields' using errcode='22023';
  end if;

  v_hash:=v_sample->>'game_hash';
  v_move_array:=pg_catalog.string_to_array(coalesce(v_sample->>'moves_uci',''),'.');
  v_ply_count:=coalesce(nullif(v_sample->>'ply_count','')::integer,0);
  if coalesce(v_hash,'')!~'^[a-f0-9]{64}$'
   or coalesce(v_sample->>'opening_uci','')!~'^(?:[a-h][1-8][a-h][1-8][qrbn]?){1,24}$'
   or coalesce(v_sample->>'moves_uci','')!~'^(?:[a-h][1-8][a-h][1-8][qrbn]?)(?:\.(?:[a-h][1-8][a-h][1-8][qrbn]?)){7,499}$'
   or v_ply_count not between 8 and 500
   or pg_catalog.cardinality(v_move_array)<>v_ply_count
   or pg_catalog.array_to_string(v_move_array[1:24],'')<>v_sample->>'opening_uci'
   or (v_sample->>'start_fen' is not null and (pg_catalog.length(v_sample->>'start_fen')>100 or (v_sample->>'start_fen')!~'^[prnbqkPRNBQK1-8/]+ [wb] (?:-|K?Q?k?q?) (?:-|[a-h][36]) [0-9]+ [0-9]+$'))
   or coalesce(v_sample->>'result','') not in('w','d','b')
   or coalesce(v_sample->>'time_class','') not in('bullet','blitz','rapid','classical','unknown')
   or coalesce(v_sample->>'source_pool','') not in('chesscom','lichess','unknown')
   or coalesce(v_sample->>'rating_source','') not in('none','pgn_unverified')
   or coalesce(v_sample->>'engine_version','')!~'^19\.[0-9]+\.[0-9]+$'
   or coalesce(v_sample->>'engine_mode','') not in('full','lite','economy')
   or coalesce(v_sample->>'move_data_base64','')!~'^[A-Za-z0-9+/]+={0,2}$'
   or pg_catalog.length(v_sample->>'move_data_base64')>7000 then
   raise exception 'Invalid game metadata or move encoding' using errcode='22023';
  end if;

  v_move_data:=pg_catalog.decode(v_sample->>'move_data_base64','base64');
  if pg_catalog.octet_length(v_move_data)<>v_ply_count*10 then
   raise exception 'Move data length mismatch' using errcode='22023';
  end if;

  if (nullif(v_sample->>'white_rating','') is not null and (v_sample->>'white_rating')::int not between 100 and 4000)
   or (nullif(v_sample->>'black_rating','') is not null and (v_sample->>'black_rating')::int not between 100 and 4000)
   or (nullif(v_sample->>'white_estimate','') is not null and (v_sample->>'white_estimate')::int not between 100 and 4000)
   or (nullif(v_sample->>'black_estimate','') is not null and (v_sample->>'black_estimate')::int not between 100 and 4000)
   or (nullif(v_sample->>'white_accuracy_tenths','') is not null and (v_sample->>'white_accuracy_tenths')::int not between 0 and 1000)
   or (nullif(v_sample->>'black_accuracy_tenths','') is not null and (v_sample->>'black_accuracy_tenths')::int not between 0 and 1000)
   or coalesce((v_sample->>'analysis_depth')::int,0) not between 1 and 30
   or coalesce((v_sample->>'white_moves')::int,-1) not between 0 and 250
   or coalesce((v_sample->>'black_moves')::int,-1) not between 0 and 250
   or coalesce((v_sample->>'white_blunders')::int,-1) not between 0 and 250
   or coalesce((v_sample->>'black_blunders')::int,-1) not between 0 and 250
   or coalesce((v_sample->>'white_mistakes')::int,-1) not between 0 and 250
   or coalesce((v_sample->>'black_mistakes')::int,-1) not between 0 and 250
   or coalesce((v_sample->>'white_inaccuracies')::int,-1) not between 0 and 250
   or coalesce((v_sample->>'black_inaccuracies')::int,-1) not between 0 and 250
   or coalesce((v_sample->>'white_chances_lost')::int,-1) not between 0 and 250
   or coalesce((v_sample->>'black_chances_lost')::int,-1) not between 0 and 250 then
   raise exception 'Invalid numeric data' using errcode='22023';
  end if;
  if (nullif(v_sample->>'white_rating','') is not null or nullif(v_sample->>'black_rating','') is not null)
   and v_sample->>'rating_source'<>'pgn_unverified' then
   raise exception 'Unverified rating labels required' using errcode='22023';
  end if;
 end loop;

 select sample_count,max_samples,last_pruned_day
 into v_count,v_max,v_pruned
 from fca_private.community_game_ingest_state
 where singleton=true
 for update;

 if v_pruned<v_day then
  delete from fca_private.community_ingest_limits where window_day<v_day;
  delete from fca_private.community_game_samples where created_at<pg_catalog.now()-interval '180 days';
  select count(*)::int into v_count from fca_private.community_game_samples;
  update fca_private.community_game_ingest_state
   set sample_count=v_count,last_pruned_day=v_day where singleton=true;
 end if;

 select count(distinct value->>'game_hash')::int into v_new_requested
 from jsonb_array_elements(p_samples) as incoming(value)
 where not exists(
  select 1 from fca_private.community_game_samples existing
  where existing.game_hash=pg_catalog.decode(incoming.value->>'game_hash','hex')
 );

 if v_new_requested=0 then
  return jsonb_build_object('accepted',0,'duplicates',v_batch,'capacity_reached',false);
 end if;

 insert into fca_private.community_ingest_limits as limits(window_day,limit_kind,key_hash,sample_count)
 values(v_day,'client',p_client_hash,v_new_requested)
 on conflict(window_day,limit_kind,key_hash) do update
 set sample_count=least(1000000,limits.sample_count+excluded.sample_count)
 returning sample_count into v_limit;
 if v_limit>100 then
  return jsonb_build_object('accepted',0,'duplicates',0,'rate_limited',true);
 end if;

 if p_network_hash is not null then
  insert into fca_private.community_ingest_limits as limits(window_day,limit_kind,key_hash,sample_count)
  values(v_day,'network',p_network_hash,v_new_requested)
  on conflict(window_day,limit_kind,key_hash) do update
  set sample_count=least(1000000,limits.sample_count+excluded.sample_count)
  returning sample_count into v_limit;
  if v_limit>500 then
   return jsonb_build_object('accepted',0,'duplicates',0,'rate_limited',true);
  end if;
 end if;

 for v_sample in select value from jsonb_array_elements(p_samples) loop
  v_hash:=v_sample->>'game_hash';
  if exists(select 1 from fca_private.community_game_samples where game_hash=pg_catalog.decode(v_hash,'hex')) then
   v_dupes:=v_dupes+1;
   continue;
  end if;
  if v_count>=v_max then
   v_full:=true;
   continue;
  end if;
  v_move_data:=pg_catalog.decode(v_sample->>'move_data_base64','base64');
  insert into fca_private.community_game_samples(
   game_hash,opening_uci,moves_uci,ply_count,start_fen,move_data,
   result,time_class,source_pool,white_rating,black_rating,rating_source,
   white_accuracy_tenths,black_accuracy_tenths,white_estimate,black_estimate,
   white_moves,black_moves,white_blunders,black_blunders,white_mistakes,black_mistakes,
   white_inaccuracies,black_inaccuracies,white_chances_lost,black_chances_lost,
   engine_version,engine_mode,analysis_depth
  ) values(
   pg_catalog.decode(v_hash,'hex'),v_sample->>'opening_uci',v_sample->>'moves_uci',
   (v_sample->>'ply_count')::smallint,nullif(v_sample->>'start_fen',''),v_move_data,
   v_sample->>'result',v_sample->>'time_class',v_sample->>'source_pool',
   nullif(v_sample->>'white_rating','')::smallint,nullif(v_sample->>'black_rating','')::smallint,
   v_sample->>'rating_source',nullif(v_sample->>'white_accuracy_tenths','')::smallint,
   nullif(v_sample->>'black_accuracy_tenths','')::smallint,nullif(v_sample->>'white_estimate','')::smallint,
   nullif(v_sample->>'black_estimate','')::smallint,
   (v_sample->>'white_moves')::smallint,(v_sample->>'black_moves')::smallint,
   (v_sample->>'white_blunders')::smallint,(v_sample->>'black_blunders')::smallint,
   (v_sample->>'white_mistakes')::smallint,(v_sample->>'black_mistakes')::smallint,
   (v_sample->>'white_inaccuracies')::smallint,(v_sample->>'black_inaccuracies')::smallint,
   (v_sample->>'white_chances_lost')::smallint,(v_sample->>'black_chances_lost')::smallint,
   v_sample->>'engine_version',v_sample->>'engine_mode',(v_sample->>'analysis_depth')::smallint
  ) on conflict(game_hash) do nothing;
  get diagnostics v_rows=row_count;
  if v_rows>0 then v_accepted:=v_accepted+1;v_count:=v_count+1;
  else v_dupes:=v_dupes+1;end if;
 end loop;

 update fca_private.community_game_ingest_state set sample_count=v_count where singleton=true;
 return jsonb_build_object(
  'accepted',v_accepted,'duplicates',v_dupes,'capacity_reached',v_full or v_count>=v_max,
  'remaining_capacity',greatest(0,v_max-v_count)
 );
end;
$$;

revoke all on function public.fca_ingest_community_games(bytea,bytea,jsonb) from public,anon,authenticated;
grant execute on function public.fca_ingest_community_games(bytea,bytea,jsonb) to service_role;

commit;
