// ✅ Full rewrite v2.0 — Unified player (auto fullscreen + mini view)
import React from "react";
import { usePlayer } from "../context/PlayerContext";
import FullPlayer from "./FullPlayer";

export default function Player() {
  const { currentTrack, isFullScreen, isPlaying, togglePlay, openFullScreen } = usePlayer();

  if (!currentTrack) return null;

  // 🖥️ Show fullscreen if active
  if (isFullScreen) return <FullPlayer />;

  // 🎧 Mini player when fullscreen is closed
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white px-4 py-3 flex justify-between items-center shadow-lg">
      <div className="flex items-center gap-3">
        <img
          src={currentTrack.cover_url}
          alt={currentTrack.title}
          className="w-10 h-10 rounded-md object-cover"
        />
        <div>
          <p className="text-sm font-semibold">{currentTrack.title}</p>
          <p className="text-xs text-gray-400">{currentTrack.artist}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={togglePlay}>{isPlaying ? "⏸️" : "▶️"}</button>
        <button onClick={openFullScreen}>⛶</button>
      </div>
    </div>
  );
}
