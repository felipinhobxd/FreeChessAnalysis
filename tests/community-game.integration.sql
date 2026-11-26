begin;

do $$ begin
 if has_schema_privilege('anon','fca_private','USAGE') or has_schema_privilege('authenticated','fca_private','USAGE') then
  raise exception 'Private schema exposed';
 end if;
 if has_table_privilege('anon','fca_private.community_game_samples','SELECT') or
    has_table_privilege('authenticated','fca_private.community_game_samples','SELECT') then
  raise exception 'Full-game table exposed';
 end if;
 if has_function_privilege('anon','public.fca_ingest_community_games(bytea,bytea,jsonb)','EXECUTE') or
    has_function_privilege('authenticated','public.fca_ingest_community_games(bytea,bytea,jsonb)','EXECUTE') then
  raise exception 'Ingest RPC exposed';
 end if;
 if not(select relrowsecurity from pg_class where oid='fca_private.community_game_samples'::regclass) then
  raise exception 'RLS missing';
 end if;
 if not has_function_privilege('service_role','public.fca_ingest_community_games(bytea,bytea,jsonb)','EXECUTE') then
  raise exception 'service_role cannot ingest';
 end if;
end $$;

set local role service_role;
do $$
declare
 sample jsonb;
 result jsonb;
 client bytea:=decode(repeat('11',64),'hex');
 network bytea:=decode(repeat('22',64),'hex');
 limited_client bytea:=decode(repeat('33',64),'hex');
 i integer;
 state_count integer;
begin
 sample:=jsonb_build_object(
  'game_hash',repeat('a',64),
  'opening_uci','e2e4e7e5g1f3b8c6f1b5b7b4c2c4c7c5',
  'moves_uci','e2e4.e7e5.g1f3.b8c6.f1b5.a7a6.b5a4.g8f6',
  'ply_count',8,
  'start_fen',null,
  'move_data_base64',replace(encode(decode(repeat('00',80),'hex'),'base64'),E'\\n',''),
  'result','w','time_class','blitz','source_pool','chesscom',
  'white_rating',1500,'black_rating',1600,'rating_source','pgn_unverified',
  'white_accuracy_tenths',920,'black_accuracy_tenths',880,
  'white_estimate',1550,'black_estimate',1500,
  'white_moves',4,'black_moves',4,
  'white_blunders',1,'black_blunders',0,
  'white_mistakes',0,'black_mistakes',1,
  'white_inaccuracies',0,'black_inaccuracies',0,
  'white_chances_lost',0,'black_chances_lost',0,
  'engine_version','19.0.1','engine_mode','lite','analysis_depth',14
 );

 result:=public.fca_ingest_community_games(client,network,jsonb_build_array(sample));
 if (result->>'accepted')::int<>1 then raise exception 'Full-game insert failed: %',result;end if;
 result:=public.fca_ingest_community_games(client,network,jsonb_build_array(sample));
 if (result->>'duplicates')::int<>1 then raise exception 'Full-game deduplication failed: %',result;end if;

 if (select octet_length(move_data) from fca_private.community_game_samples where game_hash=decode(repeat('a',64),'hex'))<>80 then
  raise exception 'Per-ply binary payload length is incorrect';
 end if;
 if (select moves_uci from fca_private.community_game_samples where game_hash=decode(repeat('a',64),'hex'))<>'e2e4.e7e5.g1f3.b8c6.f1b5.a7a6.b5a4.g8f6' then
  raise exception 'Complete move sequence was not preserved';
 end if;

 begin
  perform public.fca_ingest_community_games(client,network,jsonb_build_array(sample||jsonb_build_object('pgn','private PGN')));
  raise exception 'PGN field was accepted';
 exception when sqlstate '22023' then null;
 end;

 begin
  perform public.fca_ingest_community_games(client,network,jsonb_build_array(
   jsonb_set(sample,'{move_data_base64}',to_jsonb(replace(encode(decode(repeat('00',70),'hex'),'base64'),E'\\n','')))
  ));
  raise exception 'Incorrect move data length was accepted';
 exception when sqlstate '22023' then null;
 end;

 insert into fca_private.community_ingest_limits(window_day,limit_kind,key_hash,sample_count)
 values((pg_catalog.now() at time zone 'UTC')::date,'client',limited_client,100);
 sample:=jsonb_set(sample,'{game_hash}',to_jsonb(repeat('b',64)));
 result:=public.fca_ingest_community_games(limited_client,network,jsonb_build_array(sample));
 if result->>'rate_limited' is distinct from 'true' then raise exception 'Daily client limit failed: %',result;end if;

 update fca_private.community_game_ingest_state set sample_count=49999 where singleton=true;
 sample:=jsonb_set(sample,'{game_hash}',to_jsonb(repeat('c',64)));
 result:=public.fca_ingest_community_games(decode(repeat('44',64),'hex'),decode(repeat('55',64),'hex'),jsonb_build_array(sample));
 if (result->>'accepted')::int<>1 or result->>'capacity_reached'<>'true' then
  raise exception 'Global capacity handling failed: %',result;
 end if;
 select sample_count into state_count from fca_private.community_game_ingest_state where singleton=true;
 if state_count<>50000 then raise exception 'Global sample counter incorrect: %',state_count;end if;
end $$;
reset role;
rollback;
