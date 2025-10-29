// ✅ Full rewrite v2.0 — Fullscreen player with auto-play and mini-player toggle
import React, { useEffect } from "react";
import { usePlayer } from "../context/PlayerContext";

export default function FullPlayer() {
  const { currentTrack, isPlaying, togglePlay, closeFullScreen, audioRef } = usePlayer();

  useEffect(() => {
    if (audioRef.current && currentTrack && !isPlaying) {
      audioRef.current.play().catch(console.error);
    }
  }, [currentTrack]);

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 text-white">
      <img
        src={currentTrack.cover_url}
        alt={currentTrack.title}
        className="w-48 h-48 rounded-lg mb-6 object-cover"
      />
      <h2 className="text-xl font-bold">{currentTrack.title}</h2>
      <p className="text-gray-400 mb-4">{currentTrack.artist}</p>

      <div className="flex gap-6 mt-4">
        <button onClick={togglePlay} className="px-6 py-3 bg-purple-600 rounded-md">
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => {
            closeFullScreen();
          }}
          className="px-6 py-3 bg-gray-600 rounded-md"
        >
          Close
        </button>
      </div>
    </div>
  );
}
