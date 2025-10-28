"use client";
/**
 * This file is a modified version of a file from the OKV-Music project.
 * Original project: https://github.com/onamkrverma/okv-music
 * Licensed under the Mozilla Public License 2.0 (MPL-2.0).
 * Modifications © 2025 Purple Music Team.
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

export type PlayerState = {
  videoId: string | null;
  playing: boolean;
  setVideo: (id: string | null) => void;
  play: () => void;
  pause: () => void;
};

const Ctx = createContext<PlayerState | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const setVideo = useCallback((id: string | null) => {
    setVideoId(id);
    setPlaying(false);
  }, []);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  const value = useMemo(() => ({ videoId, playing, setVideo, play, pause }), [videoId, playing, setVideo, play, pause]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
