import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import PlaylistCard from '@/components/PlaylistCard';

type Playlist = {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  category?: string | null;
  created_at?: string | null;
};

function groupByCategory(list: Playlist[]): Record<string, Playlist[]> {
  const groups: Record<string, Playlist[]> = {};
  for (const p of list) {
    const key = p.category && p.category.trim() ? p.category : 'music';
    if (!groups[key]) groups[key] = [];
    if (groups[key].length < 8) groups[key].push(p);
  }
  return groups;
}

function SkeletonRow({ title }: { title: string }) {
  return (
    <section className="mb-8">
      <h3 className="text-lg md:text-xl font-semibold mb-3 px-1 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300">
        {title}
      </h3>
      <div className="flex gap-4 overflow-x-auto scroll-smooth px-1 pb-2 scrollbar-hide">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-40 md:w-48 lg:w-52"
          >
            <div className="aspect-square rounded-xl bg-purple-900/40 animate-pulse" />
            <div className="h-4 w-24 mt-2 rounded bg-purple-900/40 animate-pulse" />
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

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data, error, status } = await supabase
          .from('playlists')
          .select('id, title, cover_url, category, description, region, created_at')
          .order('created_at', { ascending: false });

        let list = (data || []) as Playlist[];
        if (error) {
          const msg = String((error as any)?.message || '');
          const isUserIdConflict = msg.toLowerCase().includes('user_id');
          const is400 = (status === 400) || (error as any)?.status === 400;
          if (isUserIdConflict || is400) {
            console.warn('Non-blocking Supabase warning:', { status, message: msg });
          } else {
            // eslint-disable-next-line no-console
            console.error('Supabase error fetching playlists:', msg);
            throw error;
          }
        }
        const grouped = groupByCategory(list);
        if (!isMounted) return;
        setGroups(grouped);
        // eslint-disable-next-line no-console
        console.log('✅ Playlists loaded by category:', Object.keys(grouped));
        setLoading(false);
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message || 'Failed to load playlists');
        setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const categoryOrder = useMemo(() => Object.keys(groups), [groups]);

  return (
    <div className="min-h-screen px-4 md:px-8 pt-16 pb-24 bg-gradient-to-b from-[#0d001a] to-[#1a0033] text-white">
      {loading && (
        <>
          <SkeletonRow title={t('home.mostPopular', { defaultValue: 'Most popular' })} />
          <SkeletonRow title={t('home.trendingNow', { defaultValue: 'Trending now' })} />
        </>
      )}

      {!loading && error && (
        <div className="text-sm text-purple-200/80 py-8">{error}</div>
      )}

      {!loading && !error && categoryOrder.length === 0 && (
        <div className="text-sm text-purple-200/80 py-8">
          {t('home.emptyCategory', { defaultValue: 'Nothing here yet — check back soon.' })}
        </div>
      )}

      {!loading && !error && categoryOrder.map((cat) => {
        const items = groups[cat] || [];
        if (items.length === 0) return null;
        const title = t(`home.${cat}`, { defaultValue: cat });
        return (
          <section key={cat} className="mb-8">
            <h3 className="text-lg md:text-xl font-semibold mb-3 px-1 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300">
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
