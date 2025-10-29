// ✅ Full rewrite v2.2 — openFull now accepts (list, startIndex)
import React, { createContext, useContext, useState, useRef } from "react";

interface Track {
  id: string;
  title: string;
  artist: string;
  cover_url?: string;
  audio_url?: string;
}

interface PlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  isFullOpen: boolean;
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  openFull: (list?: Track[], startIndex?: number) => void; // ✅ now supports args
  closeFull: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullOpen, setIsFullOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsFullOpen(true);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = track.audio_url || "";
      audioRef.current.play().catch(console.error);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  // ✅ Fixed: openFull accepts optional list and index
  const openFull = (list?: Track[], startIndex?: number) => {
    if (list && list.length > 0) {
      setQueue(list);
      const idx = typeof startIndex === "number" ? startIndex : 0;
      setCurrentIndex(idx);
      setCurrentTrack(list[idx]);
    }
    setIsFullOpen(true);
    setIsPlaying(true);
    if (audioRef.current && list && list[startIndex ?? 0]) {
      audioRef.current.src = list[startIndex ?? 0].audio_url || "";
      audioRef.current.play().catch(console.error);
    }
  };

  const closeFull = () => setIsFullOpen(false);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        currentIndex,
        isPlaying,
        isFullOpen,
        playTrack,
        togglePlay,
        openFull,
        closeFull,
        audioRef,
      }}
    >
      {children}
      <audio ref={audioRef} hidden />
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
};
