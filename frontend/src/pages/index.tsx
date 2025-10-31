import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import SearchBar from '@/components/SearchBar';
import ScrollableRow from '@/components/ScrollableRow';
import { supabase } from '@/utils/supabaseClient';
import { getRecent as getLocalRecent } from '@/lib/recent';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PlaylistTileSkeleton } from '@/components/Skeleton';

type Playlist = {
  id: string;
  title: string;
  cover_url: string | null;
  region: string | null;
  category: string | null;
  created_at?: string;
};

const categoryDefs = [
  { key: 'mostPopular' as const },
  { key: 'trendingNow' as const },
  { key: 'best80s' as const },
  { key: 'best90s' as const },
  { key: 'best2000' as const },
] as const;

export default function IndexPage() {
  const { t } = useTranslation();
  const [recent, setRecent] = useState<Playlist[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, Playlist[]>>({});
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);

  useEffect(() => {
    // 1) Load local Recently Played immediately
    const local = getLocalRecent().map((r) => ({
      id: r.id,
      title: r.title,
      cover_url: r.cover_url ?? null,
      region: r.region ?? null,
      category: r.category ?? null,
      created_at: r.played_at,
    }));
    if (local.length) {
      setRecent(local as Playlist[]);
      setLoadingRecent(false);
    }

    // 2) Also fetch newest public playlists as fallback/filler and merge up to 8
    (async () => {
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('id, title, cover_url, region, category, created_at')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(12);
        if (error) throw error;
        const remote = (data || []) as Playlist[];
        // Merge: local first, then remote excluding duplicates, keep 8
        const seen = new Set(local.map((x) => x.id));
        const merged = [...local, ...remote.filter((r) => !seen.has(r.id))].slice(0, 8);
        setRecent(merged);
        setLoadingRecent(false);
      } catch (e) {
        if (!local.length) {
          console.warn('recently played fetch error', e);
          setRecent([]);
          setLoadingRecent(false);
        }
      }
    })();

    // Sections by category — use backend fields (quality_score, created_at, genre/keyword_used)
    (async () => {
      try {
        const results: Record<string, Playlist[]> = {};
        for (const def of categoryDefs) {
          try {
            let query = supabase
              .from('playlists')
              .select('id, title, cover_url, region, category')
              .eq('is_public', true)
              .limit(12);

            if (def.key === 'mostPopular') {
              // Highest quality first
              query = query.order('quality_score', { ascending: false }).order('created_at', { ascending: false });
            } else if (def.key === 'trendingNow') {
              // Newest first
              query = query.order('created_at', { ascending: false });
            } else if (def.key === 'best80s') {
              // Match keyword or title hints
              query = query
                .or('genre.eq.80s,keyword_used.eq.80s,title.ilike.%80s%')
                .order('quality_score', { ascending: false });
            } else if (def.key === 'best90s') {
              query = query
                .or('genre.eq.90s,keyword_used.eq.90s,title.ilike.%90s%')
                .order('quality_score', { ascending: false });
            } else if (def.key === 'best2000') {
              query = query
                .or('genre.eq.2000s,keyword_used.eq.2000s,title.ilike.%2000%')
                .order('quality_score', { ascending: false });
            }

            const { data, error } = await query;
            if (error) throw error;
            results[def.key] = (data || []) as Playlist[];
          } catch (err) {
            console.warn('category fetch error', def.key, err);
            results[def.key] = [];
          }
        }
        setByCategory(results);
        setLoadingCats(false);
      } catch (e) {
        console.warn('category sections error', e);
        setByCategory({});
        setLoadingCats(false);
      }
    })();
  }, []);

  return (
  <div className="space-y-10 px-4 md:px-8 pt-16 pb-20">
      <div className="pt-2">
        <SearchBar />
      </div>

      <section>
        {loadingRecent ? (
          <>
            <h3 className="text-base md:text-lg font-semibold mb-3 px-2 bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">{t('home.recentlyPlayed')}</h3>
            <div className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory px-2 pb-2 scrollbar-hide">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="snap-start min-w-[10rem]">
                  <PlaylistTileSkeleton large />
                </div>
              ))}
            </div>
          </>
        ) : recent.length > 0 ? (
          <ScrollableRow title={t('home.recentlyPlayed')} playlists={recent} />
        ) : (
          <>
            <h3 className="text-base md:text-lg font-semibold mb-3 px-2 bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">{t('home.recentlyPlayed')}</h3>
            <div className="text-sm text-gray-400 px-2 py-4">{t('home.emptyRecent')}</div>
          </>
        )}
      </section>

      {categoryDefs.map((def) => (
        <section key={def.key}>
          {loadingCats ? (
            <>
              <h3 className="text-base md:text-lg font-semibold mb-3 px-2 bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">{t(`home.${def.key}`)}</h3>
              <div className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory px-2 pb-2 scrollbar-hide">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="snap-start min-w-[9rem]">
                    <PlaylistTileSkeleton />
                  </div>
                ))}
              </div>
            </>
          ) : (byCategory[def.key] || []).length > 0 ? (
            <ScrollableRow title={t(`home.${def.key}`)} playlists={byCategory[def.key] || []} />
          ) : (
            <>
              <h3 className="text-base md:text-lg font-semibold mb-3 px-2 bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">{t(`home.${def.key}`)}</h3>
              <div className="text-sm text-gray-400 px-2 py-4">{t('home.emptyCategory')}</div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

// PlaylistTile removed in favor of reusable PlaylistCard inside ScrollableRow.
