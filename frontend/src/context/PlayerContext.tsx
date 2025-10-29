import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { Howl } from 'howler';

interface Track {
  id: string;
  title: string;
  artist?: string;
  cover_url?: string;
  url?: string;
}

interface PlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isFull: boolean;
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  closeFull: () => void;
  openFull: (queue?: Track[], startIndex?: number) => void;
  setQueue: (queue: Track[]) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const soundRef = useRef<Howl | null>(null);

  const playTrack = (track: Track, q?: Track[]) => {
    if (soundRef.current) soundRef.current.stop();
    const newSound = new Howl({
      src: [track.url ?? ''],
      html5: true,
      onend: () => handleNext(),
    });
    soundRef.current = newSound;
    newSound.play();
    setCurrentTrack(track);
    setIsPlaying(true);
    if (q) setQueue(q);
    setIsFull(true);
  };

  const handleNext = () => {
    if (queue.length > 0 && currentIndex < queue.length - 1) {
      const next = queue[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      playTrack(next, queue);
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      soundRef.current.pause();
      setIsPlaying(false);
    } else {
      soundRef.current.play();
      setIsPlaying(true);
    }
  };

  const closeFull = () => {
    setIsFull(false);
  };

  const openFull = (list?: Track[], startIndex?: number) => {
    if (list && typeof startIndex === 'number') {
      setQueue(list);
      setCurrentIndex(startIndex);
      playTrack(list[startIndex], list);
    }
    setIsFull(true);
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        isFull,
        playTrack,
        togglePlay,
        closeFull,
        openFull,
        setQueue,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider');
  return ctx;
};
