begin;

create index if not exists fca_review_sync_updated_at_idx
  on public.fca_review_sync (updated_at);

create or replace function public.fca_sync_archive(
  p_code text,
  p_entries jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  lookup text;
  saved jsonb;
  combined jsonb;
begin
  if p_code is null or p_code !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid sync code';
  end if;
  lookup := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_code, 'UTF8')), 'hex');

  if p_entries is null then
    update public.fca_review_sync s
      set updated_at = pg_catalog.now()
      where s.code_hash = lookup
      returning s.entries into saved;
    return coalesce(saved, '[]'::jsonb);
  end if;

  if pg_catalog.jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Invalid archive';
  end if;
  if pg_catalog.octet_length(p_entries::text) > 1600000
     or pg_catalog.jsonb_array_length(p_entries) > 40 then
    raise exception 'Archive limit exceeded';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_entries) x(entry)
    where coalesce(x.entry->>'id', '') !~ '^[a-f0-9]{64}$'
       or coalesce(x.entry->>'date', '') !~ '^[0-9]{1,15}$'
       or pg_catalog.jsonb_typeof(x.entry->'data') is distinct from 'object'
  ) then
    raise exception 'Invalid archive entries';
  end if;

  select s.entries into saved
  from public.fca_review_sync s
  where s.code_hash = lookup
  for update;

  if not found then
    if p_entries = '[]'::jsonb then return p_entries; end if;
    perform pg_catalog.pg_advisory_xact_lock(419605113);

    delete from public.fca_review_sync s
    where s.updated_at < pg_catalog.now() - interval '180 days';

    if not exists (
      select 1 from public.fca_review_sync s where s.code_hash = lookup
    ) and (select count(*) from public.fca_review_sync) >= 128 then
      raise exception 'Sync storage limit reached';
    end if;

    insert into public.fca_review_sync(code_hash)
    values (lookup)
    on conflict do nothing;

    select s.entries into saved
    from public.fca_review_sync s
    where s.code_hash = lookup
    for update;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(kept.entry order by kept.stamp desc, kept.id),
    '[]'::jsonb
  )
  into combined
  from (
    select deduped.entry, deduped.stamp, deduped.id
    from (
      select distinct on (rows.entry->>'id')
        rows.entry,
        (rows.entry->>'date')::bigint as stamp,
        rows.entry->>'id' as id
      from (
        select entry, 0 as priority
        from pg_catalog.jsonb_array_elements(saved) x(entry)
        union all
        select entry, 1 as priority
        from pg_catalog.jsonb_array_elements(p_entries) x(entry)
      ) rows
      order by rows.entry->>'id',
        (rows.entry->>'date')::bigint desc,
        rows.priority desc
    ) deduped
    order by deduped.stamp desc, deduped.id
    limit 40
  ) kept;

  while pg_catalog.octet_length(combined::text) > 1600000
    and pg_catalog.jsonb_array_length(combined) > 1 loop
    select coalesce(
      pg_catalog.jsonb_agg(kept.entry order by kept.stamp desc, kept.id),
      '[]'::jsonb
    )
    into combined
    from (
      select item.entry, item.stamp, item.id
      from (
        select value as entry,
          (value->>'date')::bigint as stamp,
          value->>'id' as id
        from pg_catalog.jsonb_array_elements(combined)
      ) item
      order by item.stamp desc, item.id
      limit pg_catalog.jsonb_array_length(combined) - 1
    ) kept;
  end loop;

  if pg_catalog.octet_length(combined::text) > 1600000 then
    raise exception 'Archive entry too large';
  end if;

  update public.fca_review_sync
  set entries = combined, updated_at = pg_catalog.now()
  where code_hash = lookup;

  return combined;
end;
$$;

revoke all on function public.fca_sync_archive(text, jsonb) from public, anon, authenticated;
grant execute on function public.fca_sync_archive(text, jsonb) to anon, authenticated;

commit;
