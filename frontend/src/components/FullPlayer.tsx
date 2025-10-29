"use client";
import React, { useEffect, useMemo, useRef } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, SkipBack, SkipForward, Pause, Play as PlayIcon, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function FullPlayer() {
  const { t } = useTranslation();
  const { isFullPlayerOpen, videoId, queue, currentIndex, togglePlay, isPlaying, playNext, playPrev, closeFullPlayer, registerPlayer } = usePlayer();
  const current = useMemo(() => queue[currentIndex] || null, [queue, currentIndex]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!isFullPlayerOpen) return;
    if (iframeRef.current) registerPlayer(iframeRef.current);
  }, [isFullPlayerOpen, registerPlayer]);

  const originParam = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin) : '';
  const vid = videoId || current?.external_id || '';

  return (
    <AnimatePresence>
      {isFullPlayerOpen && (
        <motion.div className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0010cc] to-[#1a0024cc] backdrop-blur-md" />

          {/* Panel */}
          <motion.div className="absolute inset-0 flex flex-col max-w-5xl mx-auto px-4 py-6"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: 0.2 }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3 text-gray-100">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{current?.title || t('player.nothing')}</div>
                <div className="text-sm text-gray-300 truncate">{current?.artist || ''}</div>
              </div>
              <button onClick={closeFullPlayer} aria-label={t('player.minimize')} className="p-2 rounded hover:bg-purple-900/40">
                <ChevronDown size={22} />
              </button>
            </div>

            {/* Video */}
            <div className="w-full aspect-video min-h-[220px] rounded-lg overflow-hidden border border-purple-800/60 bg-black">
              {vid ? (
                <iframe
                  ref={iframeRef}
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${vid}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&origin=${encodeURIComponent(originParam)}`}
                  title={t('player.playerTitle')}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full bg-[#120018]" />
              )}
            </div>

            {/* Controls */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={playPrev} className="px-3 py-2 rounded bg-purple-900/40 text-gray-100 hover:bg-purple-800/50">
                  <SkipBack size={18} />
                </button>
                <button onClick={togglePlay} className="px-3 py-2 rounded bg-purple-900/40 text-gray-100 hover:bg-purple-800/50">
                  {isPlaying ? <Pause size={18} /> : <PlayIcon size={18} />}
                </button>
                <button onClick={playNext} className="px-3 py-2 rounded bg-purple-900/40 text-gray-100 hover:bg-purple-800/50">
                  <SkipForward size={18} />
                </button>
              </div>
              {vid && (
                <a
                  className="inline-flex items-center gap-2 px-3 py-2 rounded bg-white text-[#111111] hover:bg-gray-100"
                  href={`https://www.youtube.com/watch?v=${vid}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  <ExternalLink size={16} />
                  <span>{t('player.watchOnYouTube')}</span>
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
