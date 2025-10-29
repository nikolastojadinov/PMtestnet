// ✅ Full rewrite v2.0 — unified player state
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
  isPlaying: boolean;
  isFullScreen: boolean;
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  openFullScreen: () => void;
  closeFullScreen: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsFullScreen(true);
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

  const openFullScreen = () => setIsFullScreen(true);
  const closeFullScreen = () => setIsFullScreen(false);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isFullScreen,
        playTrack,
        togglePlay,
        openFullScreen,
        closeFullScreen,
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
