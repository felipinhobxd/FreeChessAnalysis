begin;

create schema if not exists fca_private;
revoke all on schema fca_private from public, anon, authenticated;

create table fca_private.archive_creation_buckets (
  bucket_start timestamptz not null,
  source_hash bytea not null,
  created_count integer not null check (created_count between 1 and 3),
  primary key (bucket_start, source_hash)
);
alter table fca_private.archive_creation_buckets enable row level security;
revoke all on fca_private.archive_creation_buckets from public, anon, authenticated;

create function fca_private.limit_archive_creation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  headers jsonb;
  client_address inet;
  client_network cidr;
  utc_day timestamptz := pg_catalog.date_trunc('day', pg_catalog.clock_timestamp(), 'UTC');
  daily_source bytea;
  updated_count integer;
begin
  -- A retried INSERT ON CONFLICT needs no new slot or creation allowance.
  if exists (select 1 from public.fca_review_sync where code_hash = new.code_hash) then
    return new;
  end if;

  headers := nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb;
  begin
    client_address := (headers->>'cf-connecting-ip')::inet;
  exception when invalid_text_representation then
    client_address := null;
  end;
  if client_address is null then
    raise sqlstate 'PT503' using message = 'Cloud archive origin unavailable';
  end if;

  client_network := pg_catalog.network(pg_catalog.set_masklen(client_address,
    case when pg_catalog.family(client_address) = 4 then 32 else 64 end));
  daily_source := pg_catalog.sha256(pg_catalog.convert_to(
    extract(epoch from utc_day)::bigint::text || '/' || client_network::text, 'UTF8'));

  delete from fca_private.archive_creation_buckets where bucket_start < utc_day;

  insert into fca_private.archive_creation_buckets as bucket (bucket_start, source_hash, created_count)
  values (utc_day, daily_source, 1)
  on conflict (bucket_start, source_hash) do update
    set created_count = bucket.created_count + 1
    where bucket.created_count < 3
  returning created_count into updated_count;

  if updated_count is null then
    raise sqlstate 'PT429' using message = 'Cloud archive creation limit reached';
  end if;
  return new;
end;
$$;

revoke all on function fca_private.limit_archive_creation() from public, anon, authenticated;

create trigger fca_guard_archive_creation
before insert on public.fca_review_sync
for each row execute function fca_private.limit_archive_creation();

commit;
