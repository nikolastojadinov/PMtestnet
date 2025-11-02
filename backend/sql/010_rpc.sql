-- RPCs and views helpers

-- Return up to N empty playlists (no linked tracks)
create or replace function public.get_empty_playlists(limit_count integer)
returns table (id uuid)
language sql stable as $$
  select p.id
  from public.playlists p
  left join public.playlist_tracks pt on pt.playlist_id = p.id
  where p.is_public = true
    and (pt.playlist_id is null)
  order by p.fetched_on desc nulls last
  limit greatest(limit_count, 0);
$$;
