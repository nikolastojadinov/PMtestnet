"use client";
/**
 * This file is a modified version of a file from the OKV-Music project.
 * Original project: https://github.com/onamkrverma/okv-music
 * Licensed under the Mozilla Public License 2.0 (MPL-2.0).
 * Modifications © 2025 Purple Music Team.
 */
import React, { createContext, useContext, useMemo, useState, useCallback, useRef } from 'react';

export type Track = {
  id: string | number;
  title: string | null;
  artist: string | null;
  external_id: string | null; // YouTube video ID
  cover_url?: string | null;
};

export type PlayerState = {
  // core state
  videoId: string | null;
  isPlaying: boolean;
  queue: Track[];
  currentIndex: number;
  isFullPlayerOpen: boolean;

  // actions
  setVideo: (id: string | null) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setQueue: (tracks: Track[]) => void;
  playTrack: (track: Track, index: number) => void;
  playNext: () => void;
  playPrev: () => void;
  openFullPlayer: (tracks: Track[], index: number) => void;
  closeFullPlayer: () => void;

  // player wiring
  registerPlayer: (el: HTMLIFrameElement | null) => void;
};

const Ctx = createContext<PlayerState | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueueState] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const postCommand = useCallback((func: string, args: any[] = []) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    } catch {}
  }, []);

  const setVideo = useCallback((id: string | null) => {
    setVideoId(id);
    // do not flip playing automatically here
  }, []);

  const play = useCallback(() => {
    postCommand('playVideo');
    setIsPlaying(true);
  }, [postCommand]);

  const pause = useCallback(() => {
    postCommand('pauseVideo');
    setIsPlaying(false);
  }, [postCommand]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (prev) {
        postCommand('pauseVideo');
        return false;
      } else {
        postCommand('playVideo');
        return true;
      }
    });
  }, [postCommand]);

  const setQueue = useCallback((tracks: Track[]) => {
    setQueueState(tracks || []);
    setCurrentIndex(0);
    // do not auto-start; caller decides via playTrack
  }, []);

  const playTrack = useCallback((track: Track, index: number) => {
    setCurrentIndex(index);
    setVideoId(track?.external_id ?? null);
    // slight delay can help ensure src updates before play command
    setTimeout(() => postCommand('playVideo'), 0);
    setIsPlaying(true);
  }, [postCommand]);

  const playNext = useCallback(() => {
    if (!queue.length) return;
    const next = (currentIndex + 1) % queue.length;
    const track = queue[next];
    setCurrentIndex(next);
    setVideoId(track?.external_id ?? null);
    setTimeout(() => postCommand('playVideo'), 0);
    setIsPlaying(true);
  }, [currentIndex, queue, postCommand]);

  const playPrev = useCallback(() => {
    if (!queue.length) return;
    const prev = (currentIndex - 1 + queue.length) % queue.length;
    const track = queue[prev];
    setCurrentIndex(prev);
    setVideoId(track?.external_id ?? null);
    setTimeout(() => postCommand('playVideo'), 0);
    setIsPlaying(true);
  }, [currentIndex, queue, postCommand]);

  const registerPlayer = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el;
    // mute player once available
    setTimeout(() => postCommand('mute'), 0);
  }, [postCommand]);

  const openFullPlayer = useCallback((tracks: Track[], index: number) => {
    const list = tracks || [];
    setQueueState(list);
    const idx = Math.max(0, Math.min(index || 0, Math.max(0, list.length - 1)));
    setCurrentIndex(idx);
    const track = list[idx];
    setVideoId(track?.external_id ?? null);
    // Start playback on user gesture
    setTimeout(() => postCommand('playVideo'), 0);
    setIsPlaying(true);
    setIsFullPlayerOpen(true);
  }, [postCommand]);

  const closeFullPlayer = useCallback(() => {
    setIsFullPlayerOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      videoId,
      isPlaying,
      queue,
      currentIndex,
      isFullPlayerOpen,
      setVideo,
      play,
      pause,
      togglePlay,
      setQueue,
      playTrack,
      playNext,
      playPrev,
      openFullPlayer,
      closeFullPlayer,
      registerPlayer,
    }),
    [videoId, isPlaying, queue, currentIndex, isFullPlayerOpen, setVideo, play, pause, togglePlay, setQueue, playTrack, playNext, playPrev, openFullPlayer, closeFullPlayer, registerPlayer]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
