import React, { useEffect, useMemo, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { usePlayer } from '@/context/PlayerContext';

// Extract the YouTube video ID from a URL like
// https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID
function getYouTubeId(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '') || null;
    }
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v');
    }
  } catch {}
  return null;
}

export default function FullPlayer() {
  const {
    currentTrack,
    queue,
    currentTrackIndex,
    isPlaying,
    playTrack,
    openFull,
    closeFull,
    isFullScreen,
  } = usePlayer();

  const [ytReady, setYtReady] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);
  const playerRef = useRef<any>(null);

  const videoId = useMemo(() => getYouTubeId(currentTrack?.url), [currentTrack?.url]);
  const youtubeUrl = currentTrack?.url && videoId ? currentTrack.url : null;

  // Auto-play on mount or when track changes (YouTube only)
  useEffect(() => {
    if (!videoId || !ytReady || !playerRef.current) return;
    try {
      playerRef.current.playVideo();
      setYtPlaying(true);
    } catch {}
  }, [videoId, ytReady]);

  // If fullscreen flag is off or no track, do not render
  useEffect(() => {
    if (currentTrack && !isFullScreen) {
      // Ensure fullscreen mode is engaged when player appears via playTrack()
      openFull();
    }
  }, [currentTrack, isFullScreen, openFull]);

  if (!currentTrack || !isFullScreen) return null;

  const onYTReady: YouTubeProps['onReady'] = (e) => {
    playerRef.current = e.target;
    setYtReady(true);
    try {
      e.target.playVideo();
      setYtPlaying(true);
    } catch {}
  };

  const onYTStateChange: YouTubeProps['onStateChange'] = (e) => {
    // 1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
    const state = e.data;
    if (state === 1) setYtPlaying(true);
    else if (state === 2 || state === 0) setYtPlaying(false);
  };

  const handlePlayPause = () => {
    if (videoId && playerRef.current) {
      const state = playerRef.current.getPlayerState?.();
      // If playing, pause; otherwise play
      if (state === 1) {
        playerRef.current.pauseVideo();
        setYtPlaying(false);
      } else {
        playerRef.current.playVideo();
        setYtPlaying(true);
      }
      return;
    }
    // Fallback to context for non-YouTube audio
    // This uses the shared audio element
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (async () => {})();
  };

  const handleNext = () => {
    if (queue.length && currentTrackIndex != null && currentTrackIndex < queue.length - 1) {
      playTrack(queue, currentTrackIndex + 1);
    }
  };

  const handlePrev = () => {
    if (queue.length && currentTrackIndex != null && currentTrackIndex > 0) {
      playTrack(queue, currentTrackIndex - 1);
    }
  };

  const handleClose = () => {
    // Stop YT playback if active
    try { playerRef.current?.stopVideo?.(); } catch {}
    closeFull();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-gradient-to-b from-purple-950 via-black to-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          {currentTrack.cover_url && (
            <img
              src={currentTrack.cover_url}
              alt={currentTrack.title}
              className="w-12 h-12 rounded-md object-cover"
            />
          )}
          <div>
            <div className="text-lg font-semibold line-clamp-1">{currentTrack.title}</div>
            <div className="text-sm text-purple-200/80 line-clamp-1">{currentTrack.artist}</div>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="rounded-full bg-purple-800/50 hover:bg-purple-700 px-3 py-2 text-sm"
        >
          ✖ Close
        </button>
      </div>

      {/* Player Area */}
      <div className="flex-1 flex flex-col items-center px-4 pb-6">
        {/* YouTube visible player when available */}
        {videoId ? (
          <div className="w-full max-w-4xl">
            <YouTube
              videoId={videoId}
              opts={{
                width: '100%',
                height: '480',
                playerVars: {
                  autoplay: 1,
                  rel: 0,
                  modestbranding: 1,
                },
              }}
              onReady={onYTReady}
              onStateChange={onYTStateChange}
              iframeClassName="rounded-xl overflow-hidden w-full"
            />
            {youtubeUrl && (
              <div className="mt-2 text-xs text-purple-200/80">
                Original video: <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-300">Watch on YouTube</a>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-md flex flex-col items-center mt-8">
            {currentTrack.cover_url && (
              <img
                src={currentTrack.cover_url}
                alt={currentTrack.title}
                className="w-64 h-64 rounded-xl shadow-2xl object-cover"
              />
            )}
            <div className="mt-3 text-sm text-purple-200/70">No YouTube video available.</div>
          </div>
        )}

        {/* Controls */}
        <div className="mt-6 flex items-center space-x-4">
          <button
            onClick={handlePrev}
            className="px-4 py-2 rounded-lg bg-purple-800/60 hover:bg-purple-700"
          >
            ⏮ Prev
          </button>
          <button
            onClick={handlePlayPause}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-yellow-400 text-black font-semibold hover:opacity-95"
          >
            {videoId ? (ytPlaying ? '⏸ Pause' : '▶ Play') : (isPlaying ? '⏸ Pause' : '▶ Play')}
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-lg bg-purple-800/60 hover:bg-purple-700"
          >
            ⏭ Next
          </button>
        </div>

        {/* Secondary actions */}
        <div className="mt-4 flex items-center space-x-3">
          <button className="px-4 py-2 rounded-lg bg-purple-900/60 hover:bg-purple-800">❤ Like</button>
          <button className="px-4 py-2 rounded-lg bg-purple-900/60 hover:bg-purple-800">➕ Add to Playlist</button>
        </div>
      </div>
    </div>
  );
}
