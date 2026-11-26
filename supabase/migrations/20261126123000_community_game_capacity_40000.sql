begin;

do $$
begin
 if (select sample_count from fca_private.community_game_ingest_state where singleton=true)>40000 then
  raise exception 'Full-game dataset already exceeds the new 40,000-record safety cap; prune data before lowering capacity';
 end if;
end;
$$;

alter table fca_private.community_game_ingest_state
 drop constraint community_game_ingest_state_sample_count_check,
 drop constraint community_game_ingest_state_max_samples_check;

update fca_private.community_game_ingest_state
set max_samples=40000
where singleton=true;

alter table fca_private.community_game_ingest_state
 add constraint community_game_ingest_state_sample_count_check
 check(sample_count between 0 and 40000),
 add constraint community_game_ingest_state_max_samples_check
 check(max_samples=40000);

commit;
