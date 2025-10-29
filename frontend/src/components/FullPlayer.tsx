"use client";
/**
 * Derived from OKV-Music fullscreen player UI.
 * Original project: https://github.com/onamkrverma/okv-music (MPL-2.0)
 * Modifications © 2025 Purple Music Team.
 */
import React, { useMemo } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, SkipBack, SkipForward, Pause, Play as PlayIcon, ExternalLink, Heart } from 'lucide-react';
import YouTube from 'react-youtube';
import { useTranslation } from 'react-i18next';

export default function FullPlayer() {
  const { t } = useTranslation();
  const {
    isFullOpen,
    videoId,
    queue,
    index,
    isPlaying,
    togglePlay,
    next,
    prev,
    closeFull,
    register,
  } = usePlayer() as any;

  const current = useMemo(() => queue?.[index] || null, [queue, index]);
  const originParam = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin) : '';

  return (
    <AnimatePresence>
      {isFullOpen && (
        <motion.div className="fixed inset-0 z-[70]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#120018ee] to-[#000000cc] backdrop-blur-md" />

          {/* Panel */}
          <motion.div className="absolute inset-0 flex flex-col items-center px-4 py-4"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="w-full max-w-[880px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 text-gray-100">
                <button onClick={closeFull} aria-label={t('player.minimize')} className="p-2 rounded hover:bg-purple-900/30">
                  <ChevronDown size={22} />
                </button>
                <div className="min-w-0 text-right">
                  <div className="text-lg font-semibold truncate">{current?.title || t('player.nothing')}</div>
                  <div className="text-sm text-gray-300 truncate">{current?.artist || ''}</div>
                </div>
              </div>

              {/* Video */}
              <div className="w-full aspect-video min-h-[320px] md:min-h-[420px] rounded-xl overflow-hidden border border-purple-700/40 bg-black shadow-[0_0_60px_-20px_rgba(168,85,247,0.6)]">
                {videoId ? (
                  <YouTube
                    videoId={videoId}
                    className="w-full h-full"
                    iframeClassName="w-full h-full"
                    onReady={(e) => register('full', e.target)}
                    onStateChange={(e) => {
                      // keep minimal handling; context drives state
                    }}
                    opts={{
                      playerVars: {
                        enablejsapi: 1,
                        modestbranding: 1,
                        rel: 0,
                        playsinline: 1,
                        origin: originParam,
                      },
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-[#120018]" />
                )}
              </div>

              {/* Controls */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={prev} className="px-3 py-2 rounded bg-purple-900/40 text-gray-100 hover:bg-purple-800/50">
                    <SkipBack size={18} />
                  </button>
                  <button onClick={togglePlay} className="px-3 py-2 rounded bg-purple-900/40 text-gray-100 hover:bg-purple-800/50">
                    {isPlaying ? <Pause size={18} /> : <PlayIcon size={18} />}
                  </button>
                  <button onClick={next} className="px-3 py-2 rounded bg-purple-900/40 text-gray-100 hover:bg-purple-800/50">
                    <SkipForward size={18} />
                  </button>
                </div>
                {videoId && (
                  <a className="inline-flex items-center gap-2 px-3 py-2 rounded bg-white text-[#111111] hover:bg-gray-100"
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} />
                    <span>{t('player.watchOnYouTube')}</span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
 
