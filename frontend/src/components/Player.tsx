// ✅ FULL REWRITE — Player.tsx v5.0
// - Only one player active (fullscreen OR mini)
// - Fullscreen autoplays immediately on open
// - MiniPlayer appears only after fullscreen closes
// - Controlled entirely via PlayerContext (no local state)
// - YouTube iframe always visible (complies with API rules)

import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import FullPlayer from './FullPlayer';
import MiniPlayer from './MiniPlayer';

const Player: React.FC = () => {
  const { isFullscreen, isPlaying, currentTrack } = usePlayer();

  // nothing to show if no track selected
  if (!currentTrack) return null;

  // fullscreen player has priority
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <FullPlayer />
      </div>
    );
  }

  // show mini player only if playing and not fullscreen
  if (isPlaying && !isFullscreen) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <MiniPlayer />
      </div>
    );
  }

  return null;
};

export default Player;
