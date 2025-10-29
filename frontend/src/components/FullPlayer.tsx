import React from 'react';
import { usePlayer } from '@/context/PlayerContext';

export default function FullPlayer() {
  const { currentTrack, isPlaying, togglePlay, closeFull } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 text-white flex flex-col justify-center items-center z-40">
      <div className="absolute top-4 right-4">
        <button onClick={closeFull} className="text-white text-2xl">✖</button>
      </div>

      {currentTrack.cover_url && (
        <img
          src={currentTrack.cover_url}
          alt={currentTrack.title}
          className="w-64 h-64 rounded-lg shadow-lg mb-6 object-cover"
        />
      )}

      <h2 className="text-2xl font-bold mb-2">{currentTrack.title}</h2>
      <p className="text-lg opacity-70 mb-4">{currentTrack.artist}</p>

      <button
        onClick={togglePlay}
        className="px-6 py-3 bg-purple-700 rounded-lg text-lg hover:bg-purple-600 transition"
      >
        {isPlaying ? '⏸ Pause' : '▶️ Play'}
      </button>
    </div>
  );
}
