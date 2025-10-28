/**
 * This file is a modified version of a file from the OKV-Music project.
 * Original project: https://github.com/onamkrverma/okv-music
 * Licensed under the Mozilla Public License 2.0 (MPL-2.0).
 * Modifications © 2025 Purple Music Team.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { SkipBack, Play as PlayIcon, Pause, SkipForward, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import PremiumPopup from '@/components/PremiumPopup';
import { useGuestUser } from '@/hooks/useGuestUser';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import { motion } from 'framer-motion';

// Mini-player: always visible, fixed positioning, with transport controls
export default function Player() {
  const { t } = useTranslation();
  const {
    videoId,
    queue,
    currentIndex,
    isPlaying,
    togglePlay,
    playNext,
    playPrev,
    registerPlayer,
  } = usePlayer();

  const current = useMemo(() => queue[currentIndex] || null, [queue, currentIndex]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [liked, setLiked] = useState(false);
  const wasPlaying = useRef(false);
  // TODO(v2.8): Re-enable Premium gating after Theme Settings (Prompt #19)
  const { guest } = useGuestUser();

  // register iframe to context for JS API control
  useEffect(() => {
    if (iframeRef.current) registerPlayer(iframeRef.current);
  }, [registerPlayer]);

  // reset like state when track changes
  useEffect(() => {
    setLiked(false);
  }, [current?.id]);

  // pause/resume on tab visibility changes
  useEffect(() => {
    function onVis() {
      if (document.hidden) {
        wasPlaying.current = isPlaying;
        if (isPlaying) {
          // pause via context toggle
          if (typeof document !== 'undefined') {
            const ev = new Event('player-pause');
          }
          // call directly
          // We don't have direct pause method exported; use togglePlay when playing
          togglePlay();
        }
      } else if (wasPlaying.current) {
        // resume
        togglePlay();
        wasPlaying.current = false;
      }
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isPlaying, togglePlay]);

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
    } catch (e) {
      setLiked(!next);
    }
  }

  const vid = videoId || current?.external_id || '';

  return (
    <div className="fixed bottom-16 left-4 right-4 md:right-4 md:left-auto md:w-[380px] z-40">
      <div className="rounded-xl bg-[#0b0010] border border-purple-800/60 shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 p-3">
          <div className="h-12 w-12 rounded bg-[#1a0024] overflow-hidden flex-shrink-0 relative">
            {current?.cover_url ? (
              <Image src={current.cover_url} alt={current.title || ''} fill sizes="48px" className="object-cover" />
            ) : (
              <div className="h-full w-full bg-purple-900/30" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-100 truncate">{current?.title || t('player.nothing')}</div>
            <div className="text-xs text-gray-400 truncate">{current?.artist || ''}</div>
          </div>
          <div className="flex items-center gap-1">
            <motion.button whileTap={{ scale: 0.95 }} onClick={playPrev} className="p-2 rounded hover:bg-purple-900/30 text-gray-200" aria-label={t('player.prev')}>
              <SkipBack size={18} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => {
                // Premium gating temporarily disabled for playback testing
                // TODO(v2.8): Re-enable Premium gating after Theme Settings (Prompt #19)
                togglePlay();
              }}
              className="p-2 rounded hover:bg-purple-900/30 text-gray-200" aria-label={isPlaying ? t('player.pause') : t('player.play')}
            >
              {isPlaying ? <Pause size={18} /> : <PlayIcon size={18} />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={playNext} className="p-2 rounded hover:bg-purple-900/30 text-gray-200" aria-label={t('player.next')}>
              <SkipForward size={18} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={toggleLike} className={`p-2 rounded hover:bg-purple-900/30 ${liked ? 'text-pink-400' : 'text-gray-200'}`} aria-label={t('player.like')}>
              <Heart size={18} />
            </motion.button>
          </div>
        </div>

        {/* Visible player */}
        <div className="w-full">
          {vid ? (
            <iframe
              ref={iframeRef}
              className="w-full h-[200px]"
              src={`https://www.youtube.com/embed/${vid}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1`}
              title={t('player.playerTitle')}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-[200px] bg-[#120018]" />
          )}
        </div>
      </div>

      {/* Premium popup disabled for testing */}
      {/* TODO(v2.8): Re-enable Premium gating after Theme Settings (Prompt #19) */}
      <PremiumPopup open={false} onClose={() => {}} />
    </div>
  );
}
