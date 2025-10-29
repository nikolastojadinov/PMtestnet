import React from 'react';
import { usePlayer } from '@/context/PlayerContext';

export default function Player() {
  const { currentTrack, isPlaying, togglePlay, isFull, openFull } = usePlayer();

  if (!currentTrack) return null;
  if (isFull) return null; // Hide mini player when fullscreen active

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-3 flex justify-between items-center shadow-lg z-30">
      <div className="flex items-center space-x-3">
        {currentTrack.cover_url && (
          <img src={currentTrack.cover_url} alt={currentTrack.title} className="w-12 h-12 object-cover rounded" />
        )}
        <div>
          <div className="font-semibold">{currentTrack.title}</div>
          <div className="text-sm opacity-70">{currentTrack.artist}</div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button onClick={togglePlay} className="px-3 py-2 bg-purple-700 rounded hover:bg-purple-600">
          {isPlaying ? '⏸' : '▶️'}
        </button>
        <button onClick={() => openFull()} className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600">
          🔼
        </button>
      </div>
    </div>
  );
}
