"use client";
/**
 * Derived from OKV-Music fullscreen player UI.
 * Original project: https://github.com/onamkrverma/okv-music (MPL-2.0)
 * Modifications © 2025 Purple Music Team.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, SkipBack, SkipForward, Pause, Play as PlayIcon, ExternalLink, Volume2, Heart } from 'lucide-react';
import YouTube from 'react-youtube';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { useGuestUser } from '@/hooks/useGuestUser';

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
    seek,
    currentTime,
    duration,
    volume,
    setVolume,
  } = usePlayer() as any;

  const current = useMemo(() => queue?.[index] || null, [queue, index]);
  const playerRef = useRef<any | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dur, setDur] = useState(0);
  const originParam = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin) : '';
  const { guest } = useGuestUser();
  const [liked, setLiked] = useState<boolean>(false);

  useEffect(() => {
    let id: any;
    const tick = () => {
      try {
        const t = playerRef.current?.getCurrentTime?.() || currentTime || 0;
        const d = playerRef.current?.getDuration?.() || duration || 0;
        setElapsed(t);
        setDur(d);
      } catch {}
    };
    id = setInterval(tick, 500);
    return () => { if (id) clearInterval(id); };
  }, [isFullOpen, currentTime, duration]);

  const fmt = (s: number) => {
    if (!isFinite(s) || s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  const disabledPrev = index <= 0 || !queue?.length;
  const disabledNext = !queue?.length || index >= queue.length - 1;

  const toggleLike = useCallback(async () => {
    if (!current?.id) return;
    const key = String(current.id);
    const next = !liked;
    setLiked(next);
    try {
      if (next) {
        const { error } = await supabase.from('likes').upsert({ user_id: guest.id, track_id: current.id, liked: true, created_at: new Date().toISOString() });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('likes').delete().match({ user_id: guest.id, track_id: current.id });
        if (error) throw error;
      }
    } catch (e) {
      // revert on failure
      setLiked(!next);
    }
  }, [current?.id, guest?.id, liked]);

  return (
    <AnimatePresence>
      {isFullOpen && (
        <motion.div className="fixed inset-0 z-[9999]"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}>
          {/* Backdrop gradient and radial glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0010] to-[#1a0522]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.35)_0%,transparent_60%)]" />

          {/* Panel */}
          <motion.div className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-[var(--footer-h,64px)] pt-6">
            <div className="w-full max-w-[800px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 text-gray-100">
                <button onClick={closeFull} aria-label={t('player.minimize')} className="p-2 rounded-full border-2 border-white/50 hover:border-white/80 bg-transparent">
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
                    onReady={(e) => {
                      register('full', e.target);
                      playerRef.current = e.target;
                      try { setDur(e.target.getDuration?.() || 0); } catch {}
                    }}
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

              {/* Progress + seek */}
              <div className="mt-5">
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <span className="tabular-nums w-12 text-right">{fmt(elapsed)}</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, Math.floor(dur))}
                    value={Math.floor(Math.min(Math.max(0, elapsed), dur || 0))}
                    onChange={(e) => {
                      const s = Number(e.target.value);
                      seek(s);
                      setElapsed(s);
                    }}
                    className="flex-1 accent-white [--tw-range-thumb:theme(colors.white)] [--tw-range-track:theme(colors.gray.600)] h-1.5"
                  />
                  <span className="tabular-nums w-12">{fmt(dur)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="mt-4 flex items-center justify-center gap-4 text-white">
                <button onClick={prev} disabled={disabledPrev} className={`p-3 rounded-lg border border-white/50 bg-transparent hover:bg-white/10 transition-colors ${disabledPrev ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <SkipBack size={18} />
                </button>
                <button onClick={togglePlay} className="p-3 rounded-lg border border-white/70 bg-transparent hover:bg-white/10 transition-colors h-14 w-14 flex items-center justify-center">
                  {isPlaying ? <Pause size={20} /> : <PlayIcon size={20} />}
                </button>
                <button onClick={next} disabled={disabledNext} className={`p-3 rounded-lg border border-white/50 bg-transparent hover:bg-white/10 transition-colors ${disabledNext ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <SkipForward size={18} />
                </button>
                <button onClick={toggleLike} aria-label={t('liked')} className={`p-3 rounded-lg border ${liked ? 'border-pink-400 text-pink-400' : 'border-white/50 text-white'} bg-transparent hover:bg-white/10 transition-colors`}>
                  <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
                </button>
              </div>

              {/* Volume */}
              <div className="mt-4 flex items-center justify-end gap-3 text-white/90">
                <Volume2 size={18} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Number.isFinite(volume) ? volume : 80}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-44 accent-white [--tw-range-thumb:theme(colors.white)] [--tw-range-track:theme(colors.gray.600)] h-1.5"
                />
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
 
