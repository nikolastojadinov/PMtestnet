import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import PlaylistCard from '@/components/PlaylistCard';

type Category = { id: number; name: string; group_type?: string | null };
type Playlist = {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  created_at?: string | null;
  // M2M relation via playlist_categories
  playlist_categories?: Array<{ categories: Category }> | null;
};

function groupByCategoryM2M(list: Playlist[]): Record<string, Playlist[]> {
  const groups: Record<string, Playlist[]> = {};
  for (const p of list) {
    const rel = p.playlist_categories || [];
    if (!rel.length) {
      // Fallback bucket if playlist has no categories
      const key = 'music';
      if (!groups[key]) groups[key] = [];
      if (groups[key].length < 8) groups[key].push(p);
      continue;
    }
    for (const r of rel) {
      const name = r?.categories?.name?.trim();
      if (!name) continue;
      const key = name;
      if (!groups[key]) groups[key] = [];
      if (groups[key].length < 8) groups[key].push(p);
    }
  }
  return groups;
}

function SkeletonRow({ title }: { title: string }) {
  return (
    <section className="mb-8">
      <h3 className="text-lg md:text-xl font-semibold mb-3 px-1 text-white">
        {title}
      </h3>
      <div className="flex gap-4 overflow-x-auto scroll-smooth px-1 pb-2 scrollbar-hide">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-40 md:w-48 lg:w-52"
          >
            <div className="aspect-square rounded-xl bg-[#1f1f1f] animate-pulse" />
            <div className="h-4 w-24 mt-2 rounded bg-[#1f1f1f] animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Record<string, Playlist[]>>({});

  // Demo playlists to render when Supabase is not configured or unauthorized
  const demoPlaylists: Playlist[] = [
    { id: 'demo-1', title: 'Most popular', cover_url: '', playlist_categories: [{ categories: { id: 1, name: 'Most popular', group_type: 'popularity' } }] },
    { id: 'demo-2', title: 'Trending now', cover_url: '', playlist_categories: [{ categories: { id: 2, name: 'Trending now', group_type: 'popularity' } }] },
    { id: 'demo-3', title: 'Best of 80s', cover_url: '', playlist_categories: [{ categories: { id: 3, name: 'Best of 80s', group_type: 'era' } }] },
    { id: 'demo-4', title: 'Best of 90s', cover_url: '', playlist_categories: [{ categories: { id: 4, name: 'Best of 90s', group_type: 'era' } }] },
    { id: 'demo-5', title: 'Best of 2000', cover_url: '', playlist_categories: [{ categories: { id: 5, name: 'Best of 2000', group_type: 'era' } }] },
    { id: 'demo-6', title: 'Fresh picks', cover_url: '', playlist_categories: [{ categories: { id: 6, name: 'music', group_type: 'genre' } }] },
  ];

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data, error, status } = await supabase
          .from('playlists')
          .select(`
            id,
            title,
            description,
            cover_url,
            created_at,
            is_public,
            playlist_categories!inner(
              categories(id, name, group_type)
            )
          `)
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(200);

        let list = (data || []) as Playlist[];
        if (error) {
          const msg = String((error as any)?.message || '');
          const isUserIdConflict = msg.toLowerCase().includes('user_id');
          const is400 = (status === 400) || (error as any)?.status === 400;
          const is401 = (status === 401) || /invalid api key/i.test(msg);
          if (isUserIdConflict || is400) {
            console.warn('Non-blocking Supabase warning:', { status, message: msg });
          } else if (is401 || !isSupabaseConfigured) {
            console.warn('Supabase unauthorized or not configured — showing demo content.');
            list = demoPlaylists;
          } else {
            // eslint-disable-next-line no-console
            console.error('Supabase error fetching playlists:', msg);
            throw error;
          }
        }
        // If configured but empty, show demo to avoid a blank page in early deploys
        if (list.length === 0 && !error && !isSupabaseConfigured) {
          list = demoPlaylists;
        }
        const grouped = groupByCategoryM2M(list);
        if (!isMounted) return;
        setGroups(grouped);
        // eslint-disable-next-line no-console
        console.log('✅ Playlists loaded by category (M2M):', Object.keys(grouped));
        setLoading(false);
      } catch (e: any) {
        if (!isMounted) return;
        if (!isSupabaseConfigured) {
          const grouped = groupByCategoryM2M(demoPlaylists);
          setGroups(grouped);
          setError(null);
        } else {
          setError(e?.message || 'Failed to load playlists');
        }
        setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const categoryOrder = useMemo(() => Object.keys(groups), [groups]);

  return (
    <div className="min-h-screen px-4 md:px-8 pt-16 pb-24 bg-[#121212] text-white">
      {loading && (
        <>
          <SkeletonRow title={t('home.mostPopular', { defaultValue: 'Most popular' })} />
          <SkeletonRow title={t('home.trendingNow', { defaultValue: 'Trending now' })} />
        </>
      )}

      {!loading && error && (
        <div className="text-sm text-gray-300/80 py-8">{error}</div>
      )}

      {!loading && !error && categoryOrder.length === 0 && (
        <div className="text-sm text-gray-300/80 py-8">
          {t('home.emptyCategory', { defaultValue: 'Nothing here yet — check back soon.' })}
        </div>
      )}

      {!loading && !error && categoryOrder.map((cat) => {
        const items = groups[cat] || [];
        if (items.length === 0) return null;
        const title = t(`home.${cat}`, { defaultValue: cat });
        return (
          <section key={cat} className="mb-8">
            <h3 className="text-lg md:text-xl font-semibold mb-3 px-1 text-white">
              {title}
            </h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-1 pb-2">
              {items.slice(0, 8).map((p) => (
                <div key={p.id} className="snap-start shrink-0">
                  <PlaylistCard id={p.id} title={p.title} description={p.description || undefined} cover_url={p.cover_url || undefined} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
