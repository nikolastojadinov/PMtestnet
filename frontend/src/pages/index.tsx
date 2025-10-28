import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import { supabase } from '@/lib/supabaseClient';
import { useTranslation } from 'react-i18next';

type Playlist = {
  id: string;
  title: string;
  cover_url: string | null;
  region: string | null;
  category: string | null;
  created_at?: string;
};

const categoryDefs = [
  { key: 'mostPopular', db: 'Most Popular' },
  { key: 'trendingNow', db: 'Trending Now' },
  { key: 'best80s', db: 'Best of 80s' },
  { key: 'best90s', db: 'Best of 90s' },
  { key: 'best2000', db: 'Best of 2000' },
] as const;

export default function IndexPage() {
  const { t } = useTranslation();
  const [recent, setRecent] = useState<Playlist[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, Playlist[]>>({});

  useEffect(() => {
    // Recently played (Guest): newest playlists
    (async () => {
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('id, title, cover_url, region, category, created_at')
          .order('created_at', { ascending: false })
          .limit(8);
        if (error) throw error;
        setRecent((data || []) as Playlist[]);
      } catch (e) {
        console.warn('recently played fetch error', e);
        setRecent([]);
      }
    })();

    // Sections by category
    (async () => {
      try {
        const results: Record<string, Playlist[]> = {};
        for (const def of categoryDefs) {
          const { data, error } = await supabase
            .from('playlists')
            .select('id, title, cover_url, region, category')
            .eq('category', def.db)
            .limit(12);
          if (error) {
            console.warn('category fetch error', def.db, error);
            results[def.key] = [];
          } else {
            results[def.key] = (data || []) as Playlist[];
          }
        }
        setByCategory(results);
      } catch (e) {
        console.warn('category sections error', e);
        setByCategory({});
      }
    })();
  }, []);

  return (
    <div className="space-y-10 px-4 md:px-8">
      <div className="pt-2">
        <SearchBar />
      </div>

      <section>
        <h2 className="text-lg md:text-xl font-semibold mb-4 bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">
          {t('home.recentlyPlayed')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recent.map((p) => (
            <div key={p.id}>
              <PlaylistTile p={p} large />
            </div>
          ))}
        </div>
      </section>

      {categoryDefs.map((def) => (
        <section key={def.key} className="space-y-3">
          <h3 className="text-base md:text-lg font-semibold bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">
            {t(`home.${def.key}`)}
          </h3>
          <div className="overflow-x-auto">
            <div className="flex gap-4 pr-4">
              {(byCategory[def.key] || []).map((p) => (
                <div key={p.id}>
                  <PlaylistTile p={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function PlaylistTile({ p, large = false }: { p: Playlist; large?: boolean }) {
  const { t } = useTranslation();
  return (
    <Link
      href={`/playlist/${p.id}`}
      className={`group relative rounded-lg overflow-hidden bg-[#120018] border border-purple-800/40 hover:border-purple-600/60 transition ${
        large ? 'w-full' : 'min-w-[160px] w-[180px]'
      }`}
    >
      <div className={`${large ? 'aspect-[16/9]' : 'aspect-square'} w-full overflow-hidden`}>
        {p.cover_url ? (
          <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-purple-900/30" />
        )}
      </div>
      <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/30">
        <button className="px-3 py-1.5 rounded bg-purple-700 text-white text-xs shadow-md">{t('player.play')}</button>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium truncate text-gray-100">{p.title}</div>
        <div className="text-xs text-gray-400 truncate">{p.region || p.category || t('search.playlist')}</div>
      </div>
    </Link>
  );
}
