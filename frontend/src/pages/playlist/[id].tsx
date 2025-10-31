import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { usePlayer } from '@/context/PlayerContext';
import FallbackImage from '@/components/FallbackImage';

interface Track {
  id: string;
  title: string;
  artist?: string;
  url?: string;
  cover_url?: string;
}

export default function PlaylistPage() {
  const router = useRouter();
  const { id } = router.query;
  const { playTrack } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlistTitle, setPlaylistTitle] = useState<string>('Loading...');
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchPlaylist = async () => {
      const { data: playlist } = await supabase
        .from('playlists')
        .select('title, cover_url')
        .eq('id', id)
        .single();

      const { data: songs } = await supabase
        .from('playlist_tracks')
        .select('track_id, position, tracks(id, title, artist, cover_url, source, external_id)')
        .eq('playlist_id', id)
        .order('position', { ascending: true });

      if (playlist) {
        setPlaylistTitle(playlist.title);
        setCover(playlist.cover_url);
      }

      if (songs) {
        const formattedTracks = songs.map((s: any) => ({
          id: s.tracks.id,
          title: s.tracks.title,
          artist: s.tracks.artist,
          cover_url: s.tracks.cover_url,
          url:
            s.tracks.source === 'youtube'
              ? `https://www.youtube.com/watch?v=${s.tracks.external_id}`
              : s.tracks.url,
        }));
        setTracks(formattedTracks);
      }
    };

    fetchPlaylist();
  }, [id]);

  const handlePlayAll = () => {
    if (tracks.length > 0) playTrack(tracks, 0);
  };

  const handlePlayTrack = (index: number) => {
    playTrack(tracks, index);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="flex flex-col items-center mb-6">
        {cover && (
          <FallbackImage
            src={cover}
            alt={playlistTitle}
            width={300}
            height={300}
            className="aspect-square object-cover rounded-xl shadow-lg mb-4"
          />
        )}
        <h1 className="text-3xl font-bold mb-2">{playlistTitle}</h1>
        <button
          onClick={handlePlayAll}
          className="px-5 py-3 bg-purple-700 hover:bg-purple-600 rounded-lg text-lg transition"
        >
          ▶️ Play All
        </button>
      </div>

      <div className="space-y-3">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className="flex justify-between items-center bg-gray-900 p-3 rounded hover:bg-gray-800 cursor-pointer transition"
            onClick={() => handlePlayTrack(index)}
          >
            <div className="flex items-center space-x-3">
              <FallbackImage
                src={track.cover_url || '/images/fallback-cover.jpg'}
                alt={track.title}
                width={48}
                height={48}
                className="w-12 h-12 aspect-square object-cover rounded-md"
              />
              <div>
                <div className="font-semibold">{track.title}</div>
                <div className="text-sm opacity-70">{track.artist}</div>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayTrack(index);
              }}
              className="px-3 py-1 bg-purple-700 rounded hover:bg-purple-600"
            >
              ▶️ Play
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
