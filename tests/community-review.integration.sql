begin;
do $$ begin
 if has_schema_privilege('anon','fca_private','USAGE') or has_schema_privilege('authenticated','fca_private','USAGE') then raise exception 'Private schema exposed';end if;
 if has_table_privilege('anon','fca_private.community_review_samples','SELECT') or has_table_privilege('authenticated','fca_private.community_review_samples','SELECT') then raise exception 'Table exposed';end if;
 if has_function_privilege('anon','public.fca_ingest_community_reviews(bytea,bytea,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.fca_ingest_community_reviews(bytea,bytea,jsonb)','EXECUTE') then raise exception 'RPC exposed';end if;
 if not(select relrowsecurity from pg_class where oid='fca_private.community_review_samples'::regclass) then raise exception 'RLS missing';end if;
end $$;
set local role service_role;
do $$ declare s jsonb;a jsonb;b jsonb;i int;j int;c int;begin
 s:=jsonb_build_object('game_hash',repeat('a',64),'opening_uci','e2e4e7e5g1f3b8c6f1b5b7b4c2c4c7c5','result','w','time_class','blitz','source_pool','chesscom','white_rating',1500,'black_rating',1600,'rating_source','pgn_unverified','white_accuracy_tenths',920,'black_accuracy_tenths',880,'white_estimate',1550,'black_estimate',1500,'white_moves',30,'black_moves',29,'white_blunders',1,'black_blunders',2,'white_mistakes',2,'black_mistakes',1,'white_inaccuracies',3,'black_inaccuracies',4,'white_chances_lost',0,'black_chances_lost',1,'engine_version','19.0.1','engine_mode','lite','analysis_depth',14);
 a:=public.fca_ingest_community_reviews(decode(repeat('1',64),'hex'),decode(repeat('2',64),'hex'),jsonb_build_array(s));if (a->>'accepted')::int<>1 then raise exception 'Insert failed: %',a;end if;
 a:=public.fca_ingest_community_reviews(decode(repeat('1',64),'hex'),decode(repeat('2',64),'hex'),jsonb_build_array(s));if (a->>'duplicates')::int<>1 then raise exception 'Dedup failed: %',a;end if;
 for i in 1..10 loop b:='[]';for j in 1..10 loop s:=jsonb_set(s,'{game_hash}',to_jsonb(lpad(to_hex(i*10+j),64,'0')));b:=b||jsonb_build_array(s);end loop;a:=public.fca_ingest_community_reviews(decode(repeat('3',64),'hex'),decode(repeat('4',64),'hex'),b);if (a->>'accepted')::int<>10 then raise exception 'Batch fail: %',a;end if;end loop;
 s:=jsonb_set(s,'{game_hash}',to_jsonb(lpad(to_hex(999),64,'0')));a:=public.fca_ingest_community_reviews(decode(repeat('3',64),'hex'),decode(repeat('4',64),'hex'),jsonb_build_array(s));if a->>'rate_limited'<>'true' then raise exception 'Client limit fail: %',a;end if;
 s:=s||jsonb_build_object('pgn','private PGN');begin perform public.fca_ingest_community_reviews(decode(repeat('5',64),'hex'),decode(repeat('6',64),'hex'),jsonb_build_array(s));raise exception 'PGN was accepted';exception when sqlstate '22023' then null;end;
 update fca_private.community_ingest_state set sample_count=99999 where singleton=true;s:=s-'pgn';s:=jsonb_set(s,'{game_hash}',to_jsonb(lpad(to_hex(2001),64,'0')));b:=jsonb_build_array(s);s:=jsonb_set(s,'{game_hash}',to_jsonb(lpad(to_hex(2002),64,'0')));b:=b||jsonb_build_array(s);
 a:=public.fca_ingest_community_reviews(decode(repeat('7',64),'hex'),decode(repeat('8',64),'hex'),b);if (a->>'accepted')::int<>1 or a->>'capacity_reached'<>'true' then raise exception 'Global cap fail: %',a;end if;
 select sample_count into c from fca_private.community_ingest_state where singleton=true;if c<>100000 then raise exception 'Counter incorrect: %',c;end if;
end $$;
reset role;rollback;
