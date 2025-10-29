import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import FallbackImage from '@/components/FallbackImage';
import { supabase } from '@/lib/supabaseClient';
import { usePlayer } from '@/context/PlayerContext';
import dynamic from 'next/dynamic';
const AddToPlaylistModal = dynamic(() => import('@/components/AddToPlaylistModal'), { ssr: false });
const PremiumPopup = dynamic(() => import('@/components/PremiumPopup'), { ssr: false });
import { Heart, Play, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import { TrackRowSkeleton } from '@/components/Skeleton';
import { motion } from 'framer-motion';
import { useGuestUser } from '@/hooks/useGuestUser';
import { pushRecent } from '@/lib/recent';

// Local helper types
interface TrackRow {
  track_id: number | string;
  // Supabase relationship typing can vary by schema introspection; accept any here
  tracks: any;
}

export default function PlaylistPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const { openFull } = usePlayer();
  const { t } = useTranslation();

  const [title, setTitle] = useState<string>(t('search.playlist'));
  const [cover, setCover] = useState<string | null>(null);
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<Record<string | number, boolean>>({});
  const [modal, setModal] = useState<{ open: boolean; trackId: string | number | null }>({ open: false, trackId: null });
  // TODO(v2.8): Re-enable Premium gating after Theme Settings (Prompt #19)
  const { guest } = useGuestUser();

  // Fetch playlist meta and tracks
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // playlist meta
        const { data: meta, error: mErr } = await supabase
          .from('playlists')
          .select('title, cover_url, region, category')
          .eq('id', id)
          .limit(1)
          .maybeSingle();
        if (!mErr && meta) {
          setTitle(meta.title || t('search.playlist'));
          setCover(meta.cover_url || null);
        }
      } catch (e) {
        // ignore
      }

      // track list: try 'position' first, fall back to 'added_at'
      try {
        const { data, error } = await supabase
          .from('playlist_tracks')
          .select('track_id, tracks(title, artist, duration, cover_url, external_id)')
          .eq('playlist_id', id)
          .order('position');
        if (error) throw error;
        setRows((data || []) as TrackRow[]);
        setLoading(false);
      } catch (e1) {
        try {
          const { data } = await supabase
            .from('playlist_tracks')
            .select('track_id, tracks(title, artist, duration, cover_url, external_id)')
            .eq('playlist_id', id)
            .order('added_at');
          setRows((data || []) as TrackRow[]);
          setLoading(false);
        } catch (e2) {
          setRows([]);
          setLoading(false);
        }
      }
    })();
  }, [id]);

  const trackList = useMemo(() =>
    rows
      .map((r) => ({
        id: r.track_id,
        title: r.tracks?.title ?? null,
        artist: r.tracks?.artist ?? null,
        external_id: r.tracks?.external_id ?? null,
        cover_url: r.tracks?.cover_url ?? null,
      }))
      .filter((t) => t.external_id),
  [rows]);

  const playAll = useCallback(() => {
    if (!trackList.length) return;
    const proceed = () => {
      // Open fullscreen player with the entire list from the start
  openFull(trackList as any, 0);
      // Push to local Recently Played
      if (id) {
        pushRecent({ id, title, cover_url: cover, region: undefined, category: undefined });
      }
    };
    // Premium gating disabled for testing
    // TODO(v2.8): Re-enable Premium gating after Theme Settings (Prompt #19)
    proceed();
  }, [trackList, openFull, id, title, cover]);

  async function toggleLike(trackId: string | number) {
    const key = String(trackId);
    const next = !likes[key];
    setLikes(prev => ({ ...prev, [key]: next }));
    try {
      if (next) {
        const { error } = await supabase.from('likes').upsert({
          user_id: guest.id,
          track_id: trackId,
          liked: true,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('likes').delete().match({ user_id: guest.id, track_id: trackId });
        if (error) throw error;
      }
    } catch (e) {
      // revert
      setLikes(prev => ({ ...prev, [key]: !next }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Cover */}
      <div className="w-full overflow-hidden rounded-lg transition-colors border border-purple-200 bg-white dark:border-purple-800/40 dark:bg-[#120018]">
        {cover ? (
          <div className="relative w-full max-h-[280px]">
            <Image src={cover} alt={title} width={1280} height={720} className="w-full h-auto object-cover" />
          </div>
        ) : (
          <div className="h-40 bg-purple-100 dark:bg-purple-900/30" />
        )}
      </div>

      {/* Title + actions */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold truncate">{title}</h1>
        <button
          onClick={playAll}
          className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-300 text-black font-medium shadow-md hover:brightness-110"
        >
          {t('player.playAll')}
        </button>
      </div>

      {/* Tracks */}
      <div className="divide-y transition-colors divide-purple-200 dark:divide-purple-800/40 rounded-md border border-purple-200 dark:border-purple-800/40 bg-white dark:bg-[#0b0010]">
        {loading && Array.from({ length: 6 }).map((_, i) => <TrackRowSkeleton key={i} />)}
        {!loading && rows.map((r) => (
          <motion.div key={String(r.track_id)} className="flex items-center gap-3 px-3 py-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="h-12 w-12 rounded bg-purple-100 dark:bg-[#1a0024] overflow-hidden relative">
              <div className="relative w-full h-full">
                <FallbackImage
                  src={(r.tracks?.cover_url as string) || '/images/fallback-cover.jpg'}
                  alt={r.tracks?.title || ''}
                  fill
                  sizes="48px"
                  className="object-cover rounded"
                  fallback="/images/fallback-cover.jpg"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[#111111] dark:text-gray-100 truncate">{r.tracks?.title || t('player.play')}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{r.tracks?.artist || t('player.unknownArtist')}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleLike(r.track_id)}
                className={`p-2 rounded transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/30 ${likes[String(r.track_id)] ? 'text-pink-500 dark:text-pink-400' : 'text-[#111111] dark:text-gray-300'}`}
                aria-label={t('liked')}
              >
                <Heart size={18} />
              </button>
              <button
                onClick={() => {
                  // Open fullscreen on specific track index within the full list
                  const idx = rows.findIndex((x) => x.track_id === r.track_id);
                  const list = trackList as any[];
                  const mappedIndex = Math.max(0, idx);
                  openFull(list as any, mappedIndex);
                  // Push to local Recently Played
                  if (id) {
                    pushRecent({ id, title, cover_url: cover, region: undefined, category: undefined });
                  }
                }}
                className="p-2 rounded transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/30 text-[#111111] dark:text-gray-300"
                aria-label={t('player.play')}
              >
                <Play size={18} />
              </button>
              <button
                onClick={() => setModal({ open: true, trackId: r.track_id })}
                className="p-2 rounded transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/30 text-[#111111] dark:text-gray-300"
                aria-label={t('playlists')}
              >
                <Plus size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AddToPlaylistModal
        open={modal.open}
        onClose={() => setModal({ open: false, trackId: null })}
        trackId={modal.trackId}
      />

      {/* Premium popup disabled for testing */}
      {/* TODO(v2.8): Re-enable Premium gating after Theme Settings (Prompt #19) */}
      <PremiumPopup open={false} onClose={() => {}} />
    </div>
  );
}
