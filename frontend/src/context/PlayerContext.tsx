// ✅ Full rewrite — fixes openFull logic (auto open + play)
import React, { createContext, useContext, useState, useEffect } from "react";

export interface Track {
  id: string;
  title: string;
  artist: string;
  cover_url: string;
  external_id?: string; // YouTube video ID
}

export interface PlayerContextType {
  queue: Track[];
  currentIndex: number;
  isFull: boolean;
  isPlaying: boolean;
  currentTrack: Track | null;
  openFull: (tracks: Track[], startIndex?: number) => void;
  closeFull: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setQueue: (tracks: Track[]) => void;
  setCurrentIndex: (index: number) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentTrack = queue[currentIndex] || null;

  // ✅ Automatically play when track changes
  useEffect(() => {
    if (currentTrack && isFull) setIsPlaying(true);
  }, [currentTrack, isFull]);

  const openFull = (tracks: Track[], startIndex = 0) => {
    if (tracks?.length) {
      setQueue(tracks);
      setCurrentIndex(startIndex);
      setIsFull(true);
      setIsPlaying(true); // ✅ start playing automatically
    }
  };

  const closeFull = () => {
    setIsFull(false);
  };

  const play = () => setIsPlaying(true);
  const pause = () => setIsPlaying(false);
  const togglePlay = () => setIsPlaying((prev) => !prev);

  const next = () => {
    if (currentIndex < queue.length - 1) setCurrentIndex((i) => i + 1);
  };

  const prev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  return (
    <PlayerContext.Provider
      value={{
        queue,
        currentIndex,
        isFull,
        isPlaying,
        currentTrack,
        openFull,
        closeFull,
        play,
        pause,
        togglePlay,
        next,
        prev,
        setQueue,
        setCurrentIndex,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
};
