"use client";
/**
 * Derived from OKV-Music mini player UI.
 * Original project: https://github.com/onamkrverma/okv-music (MPL-2.0)
 * Modifications © 2025 Purple Music Team.
 */
import React, { useMemo, useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Play as PlayIcon, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import YouTube from 'react-youtube';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { useGuestUser } from '@/hooks/useGuestUser';

export default function Player() {
  const { t } = useTranslation();
  const {
    videoId,
    queue,
    index,
    isPlaying,
    togglePlay,
    next,
    prev,
    openFull,
    register,
    isFullOpen,
    clear,
  } = usePlayer() as any;

  const current = useMemo(() => queue?.[index] || null, [queue, index]);
  const [liked, setLiked] = useState(false);
  const { guest } = useGuestUser();
  const origin = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin) : '';

  if (!current) return null;

  async function toggleLike() {
    if (!current) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    try {
      if (nextLiked) {
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
      setLiked(!nextLiked);
    }
  }

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
            <div className="bg-black overflow-hidden rounded-xl" style={{ width: 200, height: 200, minWidth: 200, minHeight: 200 }}>
              {videoId && !isFullOpen ? (
                <YouTube
                  videoId={videoId}
                  className="w-[200px] h-[200px]"
                  iframeClassName="w-[200px] h-[200px]"
                  onReady={(e) => register('mini', e.target)}
                  opts={{
                    playerVars: {
                      enablejsapi: 1,
                      modestbranding: 1,
                      rel: 0,
                      playsinline: 1,
                      origin,
                    },
                  }}
                />
              ) : (
                <div className="w-[200px] h-[200px] bg-[#120018]" />
              )}
            </div>

            {/* Info + controls */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => openFull(queue as any, index)} className="text-left min-w-0">
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
                  className={`p-2 rounded transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/30 ${liked ? 'text-pink-600 dark:text-pink-400' : 'text-[#111111] dark:text-gray-200'}`}
                >
                  <Heart size={18} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }} onClick={prev} aria-label={t('player.prev')} className="p-2 rounded transition-colors hover:bg-purple-100 text-[#111111] dark:hover:bg-purple-900/30 dark:text-gray-200">
                  <SkipBack size={18} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.06 }} onClick={togglePlay} aria-label={isPlaying ? t('player.pause') : t('player.play')} className="p-2 rounded transition-colors hover:bg-purple-100 text-[#111111] dark:hover:bg-purple-900/30 dark:text-gray-200">
                  {isPlaying ? <Pause size={18} /> : <PlayIcon size={18} />}
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }} onClick={next} aria-label={t('player.next')} className="p-2 rounded transition-colors hover:bg-purple-100 text-[#111111] dark:hover:bg-purple-900/30 dark:text-gray-200">
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
