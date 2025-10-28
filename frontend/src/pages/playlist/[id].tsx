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

// Local helper types
interface TrackRow {
  track_id: number | string;
  // Supabase relationship typing can vary by schema introspection; accept any here
  tracks: any;
}

export default function PlaylistPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const { setQueue, playTrack } = usePlayer();
  const { t } = useTranslation();

  const [title, setTitle] = useState<string>(t('search.playlist'));
  const [cover, setCover] = useState<string | null>(null);
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<Record<string | number, boolean>>({});
  const [modal, setModal] = useState<{ open: boolean; trackId: string | number | null }>({ open: false, trackId: null });
  const [showPremium, setShowPremium] = useState(false);
  const isPremium = false; // mock flag per instruction
  const premiumTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch playlist meta and tracks
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // playlist meta
        const { data: meta, error: mErr } = await supabase
          .from('playlists')
          .select('title, cover_url')
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
      setQueue(trackList as any);
      playTrack(trackList[0] as any, 0);
    };
    if (!isPremium) {
      setShowPremium(true);
      if (premiumTimer.current) clearTimeout(premiumTimer.current);
      premiumTimer.current = setTimeout(() => {
        setShowPremium(false);
        proceed();
      }, 5000);
    } else {
      proceed();
    }
  }, [trackList, setQueue, playTrack, isPremium]);

  async function toggleLike(trackId: string | number) {
    const key = String(trackId);
    const next = !likes[key];
    setLikes(prev => ({ ...prev, [key]: next }));
    try {
      if (next) {
        const { error } = await supabase.from('likes').upsert({
          user_id: 'Guest',
          track_id: trackId,
          liked: true,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('likes').delete().match({ user_id: 'Guest', track_id: trackId });
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
      <div className="w-full overflow-hidden rounded-lg border border-purple-800/40 bg-[#120018]">
        {cover ? (
          <div className="relative w-full max-h-[280px]">
            <Image src={cover} alt={title} width={1280} height={720} className="w-full h-auto object-cover" />
          </div>
        ) : (
          <div className="h-40 bg-purple-900/30" />
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
      <div className="divide-y divide-purple-800/40 rounded-md border border-purple-800/40 bg-[#0b0010]">
        {loading && Array.from({ length: 6 }).map((_, i) => <TrackRowSkeleton key={i} />)}
        {!loading && rows.map((r) => (
          <motion.div key={String(r.track_id)} className="flex items-center gap-3 px-3 py-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="h-12 w-12 rounded bg-[#1a0024] overflow-hidden relative">
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
              <div className="text-sm text-gray-100 truncate">{r.tracks?.title || t('player.play')}</div>
              <div className="text-xs text-gray-400 truncate">{r.tracks?.artist || t('player.unknownArtist')}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleLike(r.track_id)}
                className={`p-2 rounded hover:bg-purple-900/30 ${likes[String(r.track_id)] ? 'text-pink-400' : 'text-gray-300'}`}
                aria-label={t('liked')}
              >
                <Heart size={18} />
              </button>
              <button
                onClick={() => {
                  const run = () => {
                    const idx = rows.findIndex((x) => x.track_id === r.track_id);
                    const list = trackList as any[];
                    const mappedIndex = Math.max(0, idx);
                    setQueue(list as any);
                    const t = list[mappedIndex];
                    if (t) playTrack(t as any, mappedIndex);
                  };
                  if (!isPremium) {
                    setShowPremium(true);
                    if (premiumTimer.current) clearTimeout(premiumTimer.current);
                    premiumTimer.current = setTimeout(() => {
                      setShowPremium(false);
                      run();
                    }, 5000);
                  } else {
                    run();
                  }
                }}
                className="p-2 rounded hover:bg-purple-900/30 text-gray-300"
                aria-label={t('player.play')}
              >
                <Play size={18} />
              </button>
              <button
                onClick={() => setModal({ open: true, trackId: r.track_id })}
                className="p-2 rounded hover:bg-purple-900/30 text-gray-300"
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

      <PremiumPopup
        open={showPremium}
        onClose={() => {
          if (premiumTimer.current) clearTimeout(premiumTimer.current);
          setShowPremium(false);
        }}
      />
    </div>
  );
}
