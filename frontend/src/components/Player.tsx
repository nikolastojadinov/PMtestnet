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
    toggleFromIframe,
    // next, prev, (omitted for compact layout)
    // openFull, (omitted - no expand interaction in compact spec)
    register,
    isFullOpen,
  } = usePlayer() as any;

  // Hide mini when fullscreen is open
  if (isFullOpen) return null;

  const current = useMemo(() => queue?.[index] || null, [queue, index]);
  const origin = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin) : '';

  if (!current) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-[var(--footer-h,64px)] left-0 right-0 z-[9999] translate-y-0"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-[800px]">
          <div className="h-[90px] md:h-[96px] w-full flex items-center justify-between gap-3 px-3 rounded-2xl backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,0.55)] border border-purple-500/30 bg-black/45">
            {/* Left: render a 200x200 iframe scaled into a ~110x70 viewport */}
            <div className="shrink-0 w-[110px] h-[70px] overflow-hidden rounded-lg border border-purple-800/50 bg-black relative">
              {videoId ? (
                <div className="absolute top-0 left-0 origin-top-left scale-[0.55]" style={{ width: 200, height: 200 }}>
                  <YouTube
                    videoId={videoId}
                    className="w-[200px] h-[200px]"
                    iframeClassName="w-[200px] h-[200px]"
                    onReady={(e) => register('mini', e.target)}
                    opts={{
                      width: 200,
                      height: 200,
                      playerVars: {
                        enablejsapi: 1,
                        modestbranding: 1,
                        rel: 0,
                        playsinline: 1,
                        origin,
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="w-full h-full bg-black" />
              )}
            </div>

            {/* Right: single Play/Pause button */}
            <div className="flex-1 flex items-center justify-end">
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.04 }}
                onClick={toggleFromIframe}
                aria-label={isPlaying ? t('player.pause') : t('player.play')}
                className="w-[52px] h-[52px] flex items-center justify-center rounded-full bg-white/5 text-white/90 border border-white/10 backdrop-blur hover:bg-white/10 hover:border-white/20 transition-all shadow-md"
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
