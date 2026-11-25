begin;

create table if not exists public.fca_review_sync (
  code_hash text primary key,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(entries) = 'array')
);

alter table public.fca_review_sync enable row level security;
revoke all on public.fca_review_sync from public, anon, authenticated;

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
    select s.entries into saved from public.fca_review_sync s where s.code_hash = lookup;
    return coalesce(saved, '[]'::jsonb);
  end if;
  if jsonb_typeof(p_entries) <> 'array' then raise exception 'Invalid archive'; end if;
  if pg_catalog.octet_length(p_entries::text) > 1600000 or jsonb_array_length(p_entries) > 40 then
    raise exception 'Archive limit exceeded';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_entries) x(entry)
    where coalesce(x.entry->>'id', '') !~ '^[a-f0-9]{64}$'
       or coalesce(x.entry->>'date', '') !~ '^[0-9]{1,15}$'
       or jsonb_typeof(x.entry->'data') is distinct from 'object'
  ) then raise exception 'Invalid archive entries'; end if;

  select s.entries into saved from public.fca_review_sync s where s.code_hash = lookup for update;
  if not found then
    if p_entries = '[]'::jsonb then return p_entries; end if;
    perform pg_catalog.pg_advisory_xact_lock(419605113);
    if not exists (select 1 from public.fca_review_sync s where s.code_hash = lookup)
      and (select count(*) from public.fca_review_sync) >= 128 then
      raise exception 'Sync storage limit reached';
    end if;
    insert into public.fca_review_sync(code_hash) values (lookup) on conflict do nothing;
    select s.entries into saved from public.fca_review_sync s where s.code_hash = lookup for update;
  end if;

  select coalesce(jsonb_agg(chosen.entry order by chosen.stamp desc), '[]'::jsonb) into combined
  from (
    select distinct on (rows.entry->>'id') rows.entry,
      (rows.entry->>'date')::bigint as stamp
    from (
      select entry, 0 as priority from pg_catalog.jsonb_array_elements(saved) x(entry)
      union all
      select entry, 1 as priority from pg_catalog.jsonb_array_elements(p_entries) x(entry)
    ) rows
    order by rows.entry->>'id', (rows.entry->>'date')::bigint desc, rows.priority desc
  ) chosen;
  if pg_catalog.octet_length(combined::text) > 1600000 or jsonb_array_length(combined) > 40 then
    raise exception 'Archive limit exceeded';
  end if;
  update public.fca_review_sync set entries = combined, updated_at = now() where code_hash = lookup;
  return combined;
end;
$$;

revoke all on function public.fca_sync_archive(text, jsonb) from public, anon, authenticated;
grant execute on function public.fca_sync_archive(text, jsonb) to anon, authenticated;

commit;
