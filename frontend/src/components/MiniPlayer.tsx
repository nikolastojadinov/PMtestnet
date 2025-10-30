import React from 'react';
import { usePlayer } from '@/context/PlayerContext';

export default function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, isFullScreen, openFull, queue, currentIndex, playTrack } = usePlayer();

  if (!currentTrack) return null;
  if (isFullScreen) return null; // Hide mini player when fullscreen active

  const hasPrev = currentIndex > 0;
  const hasNext = queue.length > 0 && currentIndex >= 0 && currentIndex < queue.length - 1;

  const prev = () => {
    if (hasPrev) playTrack(queue, currentIndex - 1);
  };
  const next = () => {
    if (hasNext) playTrack(queue, currentIndex + 1);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0b0010] text-white p-3 flex justify-between items-center shadow-xl z-30 border-t border-purple-900/40">
      <div className="flex items-center space-x-3 min-w-0">
        {currentTrack.cover_url && (
          <img src={currentTrack.cover_url} alt={currentTrack.title} className="w-12 h-12 object-cover rounded" />
        )}
        <div className="min-w-0">
          <div className="font-semibold truncate">{currentTrack.title}</div>
          <div className="text-sm opacity-70 truncate">{currentTrack.artist}</div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button onClick={prev} disabled={!hasPrev} className="px-3 py-2 rounded bg-purple-900/50 disabled:opacity-40">⏮</button>
        <button onClick={togglePlay} className="px-3 py-2 rounded bg-gradient-to-r from-purple-600 to-yellow-400 text-black font-semibold">
          {isPlaying ? '⏸' : '▶️'}
        </button>
        <button onClick={next} disabled={!hasNext} className="px-3 py-2 rounded bg-purple-900/50 disabled:opacity-40">⏭</button>
        <button onClick={() => openFull()} className="px-3 py-2 rounded bg-purple-800/60 hover:bg-purple-700">🔼</button>
      </div>
    </div>
  );
}
