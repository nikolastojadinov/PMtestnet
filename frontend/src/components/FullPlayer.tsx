"use client";
/**
 * Derived from OKV-Music fullscreen player UI.
 * Original project: https://github.com/onamkrverma/okv-music (MPL-2.0)
 * Modifications © 2025 Purple Music Team.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, SkipBack, SkipForward, Pause, Play as PlayIcon, ExternalLink } from 'lucide-react';
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
    syncFromPlayerState,
  } = usePlayer() as any;

  const current = useMemo(() => queue?.[index] || null, [queue, index]);
  const playerRef = useRef<any | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const originParam = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin) : '';

  useEffect(() => {
    let id: any;
    if (playerRef.current) {
      const tick = () => {
        try {
          const t = playerRef.current?.getCurrentTime?.() || 0;
          const d = playerRef.current?.getDuration?.() || 0;
          setElapsed(t);
          setDuration(d);
        } catch {}
      };
      id = setInterval(tick, 500);
    }
    return () => { if (id) clearInterval(id); };
  }, [isFullOpen]);

  const fmt = (s: number) => {
    if (!isFinite(s) || s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isFullOpen && (
        <motion.div className="fixed inset-0 z-[9999]"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}>
          {/* Backdrop gradient and radial glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0e001a] to-[#230037]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.35)_0%,transparent_60%)]" />

          {/* Panel */}
          <motion.div className="absolute inset-0 flex flex-col items-center justify-center px-4 py-6">
            <div className="w-full max-w-[800px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 text-gray-100">
                <button onClick={closeFull} aria-label={t('player.minimize')} className="p-2 rounded-full backdrop-blur bg-transparent hover:bg-purple-700/30 border border-white/20">
                  <ChevronDown size={22} />
                </button>
                <div className="min-w-0 text-right">
                  <div className="text-2xl md:text-3xl font-semibold truncate">{current?.title || t('player.nothing')}</div>
                  <div className="text-sm md:text-base text-gray-300 truncate">{current?.artist || ''}</div>
                </div>
              </div>

              {/* Video */}
              <div className="w-full aspect-video min-h-[320px] md:min-h-[480px] rounded-xl overflow-hidden border border-gray-700/50 bg-black shadow-[0_0_80px_-20px_rgba(88,28,135,0.6)]">
                {videoId ? (
                  <YouTube
                    videoId={videoId}
                    className="w-full h-full"
                    iframeClassName="w-full h-full"
                    onReady={(e) => { register('full', e.target); playerRef.current = e.target; setDuration(e.target.getDuration?.() || 0); }}
                    onStateChange={(e) => {
                      try { syncFromPlayerState(e.data); } catch {}
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

              {/* Progress bar */}
              <div className="mt-5">
                <div className="h-1.5 w-full bg-gray-700/60 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-fuchsia-400 to-purple-400" style={{ width: duration ? `${Math.min(100, (elapsed / duration) * 100)}%` : '0%' }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-gray-300">
                  <span>{fmt(elapsed)}</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="mt-4 flex items-center justify-center gap-4 text-white">
                <button onClick={prev} className="p-3 rounded-full border border-gray-600/40 bg-[#140022]/60 hover:bg-purple-600/40 hover:border-purple-400/50 transition-colors">
                  <SkipBack size={18} />
                </button>
                <button onClick={togglePlay} className="p-3 rounded-full border border-gray-600/40 bg-[#140022]/60 hover:bg-purple-600/40 hover:border-purple-400/50 transition-colors">
                  {isPlaying ? <Pause size={18} /> : <PlayIcon size={18} />}
                </button>
                <button onClick={next} className="p-3 rounded-full border border-gray-600/40 bg-[#140022]/60 hover:bg-purple-600/40 hover:border-purple-400/50 transition-colors">
                  <SkipForward size={18} />
                </button>
              </div>

              {/* Watch on YouTube */}
              {videoId && (
                <div className="mt-3 flex justify-center">
                  <a className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-white/70 text-white hover:underline"
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} />
                    <span className="text-sm">{t('player.watchOnYouTube')}</span>
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
 
