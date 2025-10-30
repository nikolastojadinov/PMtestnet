import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FallbackImage from '@/components/FallbackImage';
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
    <div className="space-y-10 px-4 md:px-8">
      <div className="pt-2">
        <SearchBar />
      </div>

      <section>
        <ScrollableRow title={t('home.recentlyPlayed')}>
          {loadingRecent
            ? Array.from({ length: 4 }).map((_, i) => <PlaylistTileSkeleton key={i} large />)
            : recent.length > 0
              ? recent.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                  <PlaylistTile p={p} large />
                </motion.div>
              ))
              : <div className="text-sm text-gray-400 px-2 py-4">{t('home.emptyRecent')}</div>
          }
        </ScrollableRow>
      </section>

      {categoryDefs.map((def) => (
        <section key={def.key}>
          <ScrollableRow title={t(`home.${def.key}`)}>
            {loadingCats
              ? Array.from({ length: 8 }).map((_, i) => <PlaylistTileSkeleton key={i} />)
              : (byCategory[def.key] || []).length > 0
                ? (byCategory[def.key] || []).map((p) => (
                  <motion.div key={p.id} initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.2 }}>
                    <PlaylistTile p={p} />
                  </motion.div>
                ))
                : <div className="text-sm text-gray-400 px-2 py-4">{t('home.emptyCategory')}</div>
            }
          </ScrollableRow>
        </section>
      ))}
    </div>
  );
}

function PlaylistTile({ p, large = false }: { p: Playlist; large?: boolean }) {
  const { t } = useTranslation();
  const BLUR = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMScgaGVpZ2h0PScxJyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnPjxyZWN0IHdpZHRoPScxJyBoZWlnaHQ9JzEnIGZpbGw9JyMxNTAwMmUnLz48L3N2Zz4=';
  const [src, setSrc] = React.useState<string | undefined>(p.cover_url || undefined);

  return (
    <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
    <Link
      href={`/playlist/${p.id}`}
      className={`group relative rounded-lg overflow-hidden transition-colors bg-white border border-purple-200 hover:border-purple-400 dark:bg-[#120018] dark:border-purple-800/40 dark:hover:border-purple-600/60 transition ${
        large ? 'w-full' : 'min-w-[160px] w-[180px]'
      }`}
    >
      <div className={`${large ? 'aspect-[16/9]' : 'aspect-square'} w-full overflow-hidden relative`}>
        <FallbackImage
          src={src || '/images/fallback-cover.jpg'}
          alt={p.title}
          fill
          sizes={large ? '(max-width: 768px) 100vw, 50vw' : '180px'}
          className="object-cover transition-transform group-hover:scale-105 rounded-md"
          placeholder="blur"
          blurDataURL={BLUR}
          priority={large}
          fallback="/images/fallback-cover.jpg"
        />
      </div>
      <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/10 dark:bg-black/30">
        <button className="px-3 py-1.5 rounded bg-purple-700 text-white text-xs shadow-md">{t('player.play')}</button>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium truncate text-[#111111] dark:text-gray-100">{p.title}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{p.region || p.category || t('search.playlist')}</div>
      </div>
    </Link>
    </motion.div>
  );
}
