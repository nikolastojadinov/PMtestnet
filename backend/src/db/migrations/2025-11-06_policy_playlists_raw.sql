-- Optional RLS policy to allow service_role inserts into playlists_raw (idempotent)

alter table if exists public.playlists_raw enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='playlists_raw' and policyname='allow_service_role_insert_playlists_raw'
  ) then
    create policy "allow_service_role_insert_playlists_raw"
    on public.playlists_raw for insert
    to service_role
    with check (true);
  end if;
end $$;
