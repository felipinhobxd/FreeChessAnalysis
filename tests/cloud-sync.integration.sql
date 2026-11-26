begin;

set local role anon;
do $$
declare
  entry jsonb := jsonb_build_array(jsonb_build_object(
    'id', repeat('a', 64), 'date', 1, 'name', 'Example', 'data', jsonb_build_object('pgn', '1. e4')));
  first_code text := repeat('1', 64);
begin
  perform set_config('request.headers', '{"cf-connecting-ip":"192.0.2.1"}', true);
  if public.fca_sync_archive(first_code, entry) is distinct from entry then
    raise exception 'First archive creation failed';
  end if;
  perform public.fca_sync_archive(repeat('2', 64), entry);
  perform public.fca_sync_archive(repeat('3', 64), entry);
  begin
    perform public.fca_sync_archive(repeat('4', 64), entry);
    raise exception 'Fourth archive creation should be rate-limited';
  exception when sqlstate 'PT429' then null;
  end;

  if public.fca_sync_archive(first_code) is distinct from entry or
     public.fca_sync_archive(first_code, entry) is distinct from entry then
    raise exception 'Existing archives must remain accessible after reaching the creation limit';
  end if;

  perform set_config('request.headers', '{}', true);
  if public.fca_sync_archive(first_code, entry) is distinct from entry then
    raise exception 'Existing archives must work when origin metadata is absent';
  end if;
  begin
    perform public.fca_sync_archive(repeat('5', 64), entry);
    raise exception 'Creating without gateway metadata should be unavailable';
  exception when sqlstate 'PT503' then null;
  end;

  perform set_config('request.headers', '{"cf-connecting-ip":"192.0.2.2"}', true);
  if public.fca_sync_archive(repeat('4', 64), entry) is distinct from entry then
    raise exception 'A different source should have an independent creation allowance';
  end if;

  perform set_config('request.headers', '{"cf-connecting-ip":"2001:db8:1::1"}', true);
  perform public.fca_sync_archive(repeat('6', 64), entry);
  perform public.fca_sync_archive(repeat('7', 64), entry);
  perform public.fca_sync_archive(repeat('8', 64), entry);
  perform set_config('request.headers', '{"cf-connecting-ip":"2001:db8:1::2"}', true);
  begin
    perform public.fca_sync_archive(repeat('9', 64), entry);
    raise exception 'IPv6 addresses within the same network should share an allowance';
  exception when sqlstate 'PT429' then null;
  end;
end;
$$;

reset role;
do $$
begin
  if pg_catalog.has_schema_privilege('anon', 'fca_private', 'USAGE') or
     pg_catalog.has_schema_privilege('authenticated', 'fca_private', 'USAGE') or
     pg_catalog.has_table_privilege('anon', 'fca_private.archive_creation_buckets', 'SELECT') then
    raise exception 'Archive allowance data must stay private';
  end if;
end;
$$;

rollback;
