import React, { createContext, useContext, useMemo, useRef, useState } from 'react';

// Shared Track model for the app
export interface Track {
  id: string;
  title: string;
  artist?: string;
  cover_url?: string;
  url?: string; // Direct audio URL if available
}

// Context contract (new unified API)
export interface PlayerContextType {
  // State
  queue: Track[];
  currentTrackIndex: number | null;
  isFullScreen: boolean;
  isPlaying: boolean;
  activeTrack: Track | null;

  // Setters (exposed to restore original control surface)
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveTrack: React.Dispatch<React.SetStateAction<Track | null>>;

  // Derived
  currentTrack: Track | null;

  // Controls
  playTrack: (list: Track[], index: number) => void;
  openFull: (list?: Track[], index?: number) => void;
  closeFull: () => void;
  togglePlay: () => void;

  // Temporary backwards-compat helpers (to avoid breaking existing UI)
  // Deprecated: prefer isFullScreen
  isFull: boolean;
  // Alias for integrations expecting `currentIndex: number`
  currentIndex: number;
}

export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  // Core state
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);

  // Single shared audio element instance
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lazily create the audio element on first use
  const ensureAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.addEventListener('ended', () => {
        handleNext();
      });
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  // Derived current track
  // Derive current track from activeTrack to ensure a single source of truth
  const currentTrack: Track | null = useMemo(() => activeTrack, [activeTrack]);

  const loadAndPlay = (track: Track) => {
    const audio = ensureAudio();
    // If no URL, we cannot play. Keep state consistent.
    if (!track?.url) {
      setIsPlaying(false);
      return;
    }
    // Swap source if changed
    if (audio.src !== track.url) {
      audio.src = track.url;
    }
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const handleNext = () => {
    if (currentTrackIndex == null) return;
    const nextIndex = currentTrackIndex + 1;
    if (queue.length > 0 && nextIndex < queue.length) {
      setCurrentTrackIndex(nextIndex);
      const nextTrack = queue[nextIndex];
      setActiveTrack(nextTrack ?? null);
      if (nextTrack) loadAndPlay(nextTrack);
    } else {
      setIsPlaying(false);
    }
  };

  // Public API
  const playTrack = (list: Track[], index: number) => {
    // Update queue and index in one go
    setQueue(list);
    setCurrentTrackIndex(index);
    const track = list[index];
    setActiveTrack(track ?? null);
    if (track) loadAndPlay(track);
    // When playing a track directly, open fullscreen by design? Leave fullscreen as-is.
  };

  const openFull = (list?: Track[], index?: number) => {
    setIsFullScreen(true);
    if (list && typeof index === 'number') {
      // Start playback from provided list/index
      playTrack(list, index);
      return;
    }
    // Keep activeTrack unchanged; optionally resume audio if paused
    if (activeTrack) {
      const audio = ensureAudio();
      if (audio.paused) {
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    }
  };

  const closeFull = () => {
    // Restore original behavior: exiting fullscreen clears active track
    setIsFullScreen(false);
    setActiveTrack(null);
  };

  const togglePlay = () => {
    const audio = ensureAudio();
    if (!currentTrack) return; // nothing to play
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const value: PlayerContextType = {
    // State
    queue,
    currentTrackIndex,
    isFullScreen,
    isPlaying,
    activeTrack,

    // Setters
    setIsFullScreen,
    setActiveTrack,

    // Derived
    currentTrack,

    // Controls
    playTrack,
    openFull,
    closeFull,
    togglePlay,

    // Compatibility
    isFull: isFullScreen,
    currentIndex: currentTrackIndex ?? -1,
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextType {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider');
  return ctx;
}
