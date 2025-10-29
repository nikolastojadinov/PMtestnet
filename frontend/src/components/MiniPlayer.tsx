"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { Heart, Play as PlayIcon, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { useGuestUser } from '@/hooks/useGuestUser';

export default function MiniPlayer() {
  const { t } = useTranslation();
  const {
    videoId,
    queue,
    currentIndex,
    isPlaying,
    togglePlay,
    playNext,
    playPrev,
    openFullPlayer,
    registerIframe,
    isFullPlayerOpen,
    activeSurface,
    clear,
  } = usePlayer();

  const current = useMemo(() => queue[currentIndex] || null, [queue, currentIndex]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [liked, setLiked] = useState(false);
  const { guest } = useGuestUser();

  useEffect(() => {
    if (iframeRef.current) registerIframe('mini', iframeRef.current);
    return () => registerIframe('mini', null);
  }, [registerIframe]);

  useEffect(() => setLiked(false), [current?.id]);

  async function toggleLike() {
    if (!current) return;
    const next = !liked;
    setLiked(next);
    try {
      if (next) {
        const { error } = await supabase.from('likes').upsert({
          user_id: guest.id,
          track_id: current.id,
          liked: true,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('likes').delete().match({ user_id: guest.id, track_id: current.id });
        if (error) throw error;
      }
    } catch {
      setLiked(!next);
    }
  }

  const origin = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin) : '';
  const vid = videoId || current?.external_id || '';

  // Only hide iframe when fullscreen surface is active
  const showIframe = !!vid && activeSurface === 'mini' && !isFullPlayerOpen;

  if (!current) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-40"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="rounded-2xl border border-purple-200 bg-white/80 dark:bg-[#0b0010]/80 dark:border-purple-800/60 backdrop-blur-md shadow-xl flex gap-4 p-3 items-center">
            {/* Visible YouTube iframe 200x200 */}
            <div className="player-iframe-200 bg-black overflow-hidden rounded-xl">
              {showIframe ? (
                <iframe
                  ref={iframeRef}
                  className="w-[200px] h-[200px]"
                  src={`https://www.youtube.com/embed/${vid}?enablejsapi=1&playsinline=1&modestbranding=1&rel=0&origin=${encodeURIComponent(origin)}&iv_load_policy=3`}
                  title={t('player.playerTitle')}
                  frameBorder="0"
                  allow="autoplay; fullscreen; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <div className="w-[200px] h-[200px] bg-[#120018]" />
              )}
            </div>

            {/* Info + controls */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => openFullPlayer(queue as any, currentIndex)} className="text-left min-w-0">
                  <div className="text-sm font-medium text-[#111111] dark:text-gray-100 truncate" aria-label="Open fullscreen">
                    {current?.title || t('player.nothing')}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{current?.artist || ''}</div>
                </button>
                <button onClick={clear} aria-label={t('player.close')} className="p-2 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }} onClick={toggleLike}
                  aria-label={t('player.like')}
                  className={`player-ctrl ${liked ? 'text-pink-600 dark:text-pink-400' : 'text-[#111111] dark:text-gray-200'}`}
                >
                  <Heart size={18} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }} onClick={playPrev} aria-label={t('player.prev')} className="player-ctrl">
                  <SkipBack size={18} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.06 }} onClick={togglePlay} aria-label={isPlaying ? t('player.pause') : t('player.play')} className="player-ctrl">
                  {isPlaying ? <Pause size={18} /> : <PlayIcon size={18} />}
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }} onClick={playNext} aria-label={t('player.next')} className="player-ctrl">
                  <SkipForward size={18} />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
