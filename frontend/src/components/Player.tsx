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
        transition={{ duration: 0.35, ease: 'easeInOut' }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="w-full border-t border-white/10 rounded-t-2xl shadow-[0_-4px_16px_rgba(0,0,0,0.5)] bg-gradient-to-br from-[#120018] to-[#200030] bg-opacity-95 px-4 py-3">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              {/* Visible YouTube iframe 200x200 */}
              <button onClick={() => openFull(queue as any, index)} className="rounded-xl overflow-hidden border border-gray-800/60 focus:outline-none" aria-label="Expand player">
                <div className="bg-black" style={{ width: 200, height: 200, minWidth: 200, minHeight: 200 }}>
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
              </button>

              {/* Info + controls */}
              <div className="flex-1 min-w-0 px-1">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => openFull(queue as any, index)} className="text-left min-w-0">
                    <div className="text-white text-sm font-medium truncate" aria-label="Open fullscreen">
                      {current?.title || t('player.nothing')}
                    </div>
                    <div className="text-gray-400 text-xs truncate">{current?.artist || ''}</div>
                  </button>
                  <button onClick={clear} aria-label={t('player.close')} className="p-2 rounded-full border border-gray-600/40 bg-[#140022]/60 hover:bg-purple-600/40 hover:border-purple-400/50 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.04 }} onClick={toggleLike}
                    aria-label={t('player.like')}
                    className={`p-2 rounded-full border transition-colors border-gray-600/40 bg-[#140022]/60 hover:bg-purple-600/40 hover:border-purple-400/50 ${liked ? 'text-pink-400' : 'text-white'}`}
                  >
                    <Heart size={18} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.04 }} onClick={prev} aria-label={t('player.prev')} className="p-2 rounded-full border border-gray-600/40 bg-[#140022]/60 hover:bg-purple-600/40 hover:border-purple-400/50 transition-colors text-white">
                    <SkipBack size={18} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.06 }} onClick={togglePlay} aria-label={isPlaying ? t('player.pause') : t('player.play')} className="p-2 rounded-full border border-gray-600/40 bg-[#140022]/60 hover:bg-purple-600/40 hover:border-purple-400/50 transition-colors text-white">
                    {isPlaying ? <Pause size={18} /> : <PlayIcon size={18} />}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.04 }} onClick={next} aria-label={t('player.next')} className="p-2 rounded-full border border-gray-600/40 bg-[#140022]/60 hover:bg-purple-600/40 hover:border-purple-400/50 transition-colors text-white">
                    <SkipForward size={18} />
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
