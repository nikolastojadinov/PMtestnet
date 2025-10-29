"use client";
/**
 * This file is a derived and adapted implementation based on the OKV-Music project.
 * Original project: https://github.com/onamkrverma/okv-music
 * License: Mozilla Public License 2.0 (MPL-2.0)
 * Modifications © 2025 Purple Music Team.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type Track = {
  id: string | number;
  title: string | null;
  artist: string | null;
  external_id: string | null; // YouTube video ID
  cover_url?: string | null;
};

type Surface = 'mini' | 'full';

export type PlayerContextType = {
  // state
  queue: Track[];
  index: number;
  videoId: string | null;
  isPlaying: boolean;
  isFullOpen: boolean;
  activeSurface: Surface;
  current: Track | null;

  // controls
  openFull: (tracks: Track[], startIndex: number) => void;
  closeFull: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  clear: () => void;

  // player wiring
  register: (surface: Surface, player: any | null) => void;
  // state sync helpers
  syncFromPlayerState: (ytState: number) => void;
  toggleFromIframe: () => void;
};

const Ctx = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullOpen, setIsFullOpen] = useState(false);
  const [activeSurface, setActiveSurface] = useState<Surface>('mini');
  const fullPlayerRef = useRef<any | null>(null);
  const miniPlayerRef = useRef<any | null>(null);

  // Handoff helpers when switching surfaces
  const pendingSeekRef = useRef<number | null>(null);

  const current = useMemo(() => queue[index] ?? null, [queue, index]);

  const getActive = useCallback(() => (activeSurface === 'full' ? fullPlayerRef.current : miniPlayerRef.current), [activeSurface]);

  const play = useCallback(() => {
    const p = getActive();
    try { p?.playVideo?.(); } catch {}
    setIsPlaying(true);
  }, [getActive]);

  const pause = useCallback(() => {
    const p = getActive();
    try { p?.pauseVideo?.(); } catch {}
    setIsPlaying(false);
  }, [getActive]);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => {
      const p = getActive();
      try {
        if (prev) p?.pauseVideo?.(); else p?.playVideo?.();
      } catch {}
      return !prev;
    });
  }, [getActive]);

  const loadByVideoId = useCallback((vid: string | null, autoplay = false) => {
    setVideoId(vid);
    const p = getActive();
    if (!vid || !p) return;
    try {
      p.loadVideoById(vid);
      if (autoplay) p.playVideo();
    } catch {
      // fallback: cue
      try { p.cueVideoById?.(vid); } catch {}
    }
  }, [getActive]);

  const next = useCallback(() => {
    if (!queue.length) return;
    const ni = (index + 1) % queue.length;
    setIndex(ni);
    const t = queue[ni];
    loadByVideoId(t?.external_id ?? null, true);
    setIsPlaying(true);
  }, [index, queue, loadByVideoId]);

  const prev = useCallback(() => {
    if (!queue.length) return;
    const pi = (index - 1 + queue.length) % queue.length;
    setIndex(pi);
    const t = queue[pi];
    loadByVideoId(t?.external_id ?? null, true);
    setIsPlaying(true);
  }, [index, queue, loadByVideoId]);

  const seek = useCallback((seconds: number) => {
    const p = getActive();
    try { p?.seekTo?.(seconds, true); } catch {}
  }, [getActive]);

  const setVolume = useCallback((vol: number) => {
    const p = getActive();
    try { p?.setVolume?.(Math.max(0, Math.min(100, vol))); } catch {}
  }, [getActive]);

  const register = useCallback((surface: Surface, player: any | null) => {
    if (surface === 'full') fullPlayerRef.current = player; else miniPlayerRef.current = player;
    // If we have a pending seek after surface switch, apply it
    if (player && pendingSeekRef.current != null) {
      try {
        player.seekTo?.(pendingSeekRef.current, true);
        if (isPlaying) player.playVideo?.();
      } catch {}
      pendingSeekRef.current = null;
    }
  }, [isPlaying]);

  const syncFromPlayerState = useCallback((ytState: number) => {
    // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    if (ytState === 1) setIsPlaying(true);
    else if (ytState === 2 || ytState === 0) setIsPlaying(false);
  }, []);

  const toggleFromIframe = useCallback(() => {
    const p = getActive();
    if (!p) return;
    try {
      const s = p.getPlayerState?.();
      if (s === 1) {
        p.pauseVideo?.();
        setIsPlaying(false);
      } else {
        p.playVideo?.();
        setIsPlaying(true);
      }
    } catch {}
  }, [getActive]);

  const openFull = useCallback((tracks: Track[], startIndex: number) => {
    const list = tracks || [];
    const idx = Math.max(0, Math.min(startIndex || 0, Math.max(0, list.length - 1)));
    setQueue(list);
    setIndex(idx);
    const t = list[idx];
    setVideoId(t?.external_id ?? null);
    setIsFullOpen(true);
    setActiveSurface('full');
    // slight delay to ensure mount before issuing play
    setTimeout(() => play(), 50);
  }, [play]);

  const closeFull = useCallback(() => {
    // Capture current time from full, then handoff to mini
    const fp = fullPlayerRef.current;
    if (fp && typeof fp.getCurrentTime === 'function') {
      try { pendingSeekRef.current = fp.getCurrentTime(); } catch {}
    }
    // Sync playing state from full before switching
    try {
      const st = fp?.getPlayerState?.();
      if (typeof st === 'number') setIsPlaying(st === 1);
    } catch {}
    setActiveSurface('mini');
    setIsFullOpen(false);
    // mini will seek on register if pendingSeek set
    setTimeout(() => { if (isPlaying) play(); }, 60);
  }, [isPlaying, play]);

  const clear = useCallback(() => {
    setIsPlaying(false);
    try { fullPlayerRef.current?.stopVideo?.(); } catch {}
    try { miniPlayerRef.current?.stopVideo?.(); } catch {}
    setQueue([]);
    setIndex(0);
    setVideoId(null);
    setIsFullOpen(false);
  }, []);

  // Pause/resume on tab visibility
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        try { getActive()?.pauseVideo?.(); } catch {}
        setIsPlaying(false);
      } else if (videoId) {
        try { getActive()?.playVideo?.(); } catch {}
        setIsPlaying(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [getActive, videoId]);

  const value: PlayerContextType = useMemo(() => ({
    queue, index, videoId, isPlaying, isFullOpen, activeSurface, current,
    openFull, closeFull, play, pause, togglePlay, next, prev, seek, setVolume, clear, register,
    syncFromPlayerState, toggleFromIframe,
  }), [queue, index, videoId, isPlaying, isFullOpen, activeSurface, current, openFull, closeFull, play, pause, togglePlay, next, prev, seek, setVolume, clear, register, syncFromPlayerState, toggleFromIframe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
