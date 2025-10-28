/**
 * This file is a modified version of a file from the OKV-Music project.
 * Original project: https://github.com/onamkrverma/okv-music
 * Licensed under the Mozilla Public License 2.0 (MPL-2.0).
 * Modifications © 2025 Purple Music Team.
 */
import React from 'react';
import { usePlayer } from '../context/PlayerContext';

// Visible, responsive YouTube IFrame player (no hidden/background playback)
export default function Player() {
  const { videoId } = usePlayer();
  const v = videoId || 'dQw4w9WgXcQ'; // placeholder video
  return (
    <div className="pm-player aspect-video w-full">
      <iframe
        className="w-full h-full"
        src={`https://www.youtube.com/embed/${v}?rel=0&modestbranding=1`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
