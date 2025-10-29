"use client";
/**
 * Derived from OKV-Music mini player UI.
 * Original project: https://github.com/onamkrverma/okv-music (MPL-2.0)
 * Modifications © 2025 Purple Music Team.
 */
import React, { useMemo } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Play as PlayIcon, Pause } from 'lucide-react';
import YouTube from 'react-youtube';
import { useTranslation } from 'react-i18next';

export default function Player() {
  const { t } = useTranslation();
  const {
    videoId,
    queue,
    index,
    isPlaying,
    togglePlay,
    // next, prev, (omitted for compact layout)
    // openFull, (omitted - no expand interaction in compact spec)
    register,
    isFullOpen,
  } = usePlayer() as any;

  const current = useMemo(() => queue?.[index] || null, [queue, index]);
  const origin = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin) : '';

  if (!current) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-[60px] left-0 right-0 z-50"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
      >
        <div className="mx-auto max-w-[800px]">
          <div className="h-[90px] md:h-[100px] w-full flex items-center justify-between px-4 rounded-t-lg backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.6)] border-t border-purple-800/40 bg-gradient-to-r from-[#10001a] to-[#22003a]">
            {/* Left: visible YouTube iframe 120x68 (16:9) */}
            <div className="w-[120px] h-[68px] rounded-md overflow-hidden border border-purple-800/50 bg-black">
              {videoId ? (
                <YouTube
                  videoId={videoId}
                  className="w-[120px] h-[68px]"
                  iframeClassName="w-[120px] h-[68px]"
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
                <div className="w-full h-full bg-black" />
              )}
            </div>

            {/* Right: single Play/Pause button */}
            <div className="flex-1 flex justify-end items-center">
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.04 }}
                onClick={togglePlay}
                aria-label={isPlaying ? t('player.pause') : t('player.play')}
                className="w-[52px] h-[52px] flex items-center justify-center rounded-full text-white bg-[#260045] border border-purple-700/60 shadow-md shadow-purple-900/40 hover:bg-purple-700/60 hover:border-purple-400/40 transition-all duration-300"
              >
                {isPlaying ? <Pause size={20} /> : <PlayIcon size={20} />}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
