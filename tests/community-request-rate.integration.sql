begin;

do $$ begin
 if has_table_privilege('anon','fca_private.community_ingest_request_limits','SELECT') or
    has_table_privilege('authenticated','fca_private.community_ingest_request_limits','SELECT') then
  raise exception 'Request quota table is exposed';
 end if;
 if has_function_privilege('anon','public.fca_consume_community_request(bytea)','EXECUTE') or
    has_function_privilege('authenticated','public.fca_consume_community_request(bytea)','EXECUTE') then
  raise exception 'Request quota RPC is publicly executable';
 end if;
 if not has_function_privilege('service_role','public.fca_consume_community_request(bytea)','EXECUTE') then
  raise exception 'service_role cannot consume request quota';
 end if;
end $$;

set local role service_role;
do $$
declare
 v_network bytea:=decode(repeat('a1',32),'hex');
 v_other_network bytea:=decode(repeat('b2',32),'hex');
 v_result jsonb;
 v_count integer;
 i integer;
begin
 for i in 1..20 loop
  v_result:=public.fca_consume_community_request(v_network);
  if i<=15 and v_result->>'allowed'<>'true' then
   raise exception 'Request % should be allowed: %',i,v_result;
  end if;
  if i>15 and v_result->>'allowed'<>'false' then
   raise exception 'Request % should be rate limited: %',i,v_result;
  end if;
  if (v_result->>'retry_after_seconds')::int not between 1 and 60 then
   raise exception 'Invalid Retry-After value: %',v_result;
  end if;
 end loop;

 select request_count into v_count
 from fca_private.community_ingest_request_limits
 where network_hash=v_network;
 if v_count<>16 then raise exception 'Request counter was not capped at 16: %',v_count;end if;

 v_result:=public.fca_consume_community_request(v_other_network);
 if v_result->>'allowed'<>'true' then
  raise exception 'A different network must have an independent budget: %',v_result;
 end if;

 begin
  perform public.fca_consume_community_request(null);
  raise exception 'Null network hash should be rejected';
 exception when sqlstate '22023' then null;
 end;
end $$;
reset role;
rollback;
