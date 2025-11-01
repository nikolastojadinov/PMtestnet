// ✅ Full rewrite — fixes Play All & Play button logic
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { usePlayer } from "@/context/PlayerContext";
import { supabase } from "@/lib/supabaseClient";

interface Track {
  id: string;
  title: string;
  artist: string;
  cover_url: string;
  external_id: string;
}

export default function PlaylistPage() {
  const router = useRouter();
  const { id } = router.query;
  const { playTrack } = usePlayer();

  const [playlist, setPlaylist] = useState<any>(null);
  const [trackList, setTrackList] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchPlaylist = async () => {
      setLoading(true);

      // ✅ Load playlist data
      const { data: playlistData } = await (supabase as any)
        .from("playlists")
        .select("*")
        .eq("id", id)
        .single();

      // ✅ Load track list for the playlist
      const { data: tracksData } = await (supabase as any)
        .from("playlist_tracks")
        .select("track_id, tracks(*)")
        .eq("playlist_id", id);

      const tracks =
        tracksData?.map((t: any) => ({
          id: t.tracks.id,
          title: t.tracks.title,
          artist: t.tracks.artist,
          cover_url: t.tracks.cover_url,
          external_id: t.tracks.external_id,
        })) || [];

      setPlaylist(playlistData);
      setTrackList(tracks);
      setLoading(false);
    };

    fetchPlaylist();
  }, [id]);

  if (loading) return <div className="p-4 text-center text-white">Loading...</div>;
  if (!playlist) return <div className="p-4 text-center text-white">Playlist not found.</div>;

  const handlePlayAll = () => {
    if (trackList.length > 0) {
      playTrack(trackList, 0);
    }
  };

  const handlePlaySingle = (index: number) => {
    playTrack(trackList, index);
  };

  return (
    <div className="p-4 text-white bg-black min-h-screen">
      <div className="flex flex-col items-center">
        {playlist.cover_url && (
          <img
            src={playlist.cover_url}
            alt={playlist.title}
            className="w-full max-w-md rounded-lg mb-4"
          />
        )}
        <h1 className="text-2xl font-bold mb-2 text-center">{playlist.title}</h1>
        <button
          onClick={handlePlayAll}
          className="px-4 py-2 mb-6 rounded-full bg-gradient-to-r from-purple-500 to-yellow-400 text-black font-semibold"
        >
          ▶ Play All
        </button>
      </div>

      <div className="space-y-3">
        {trackList.map((track, index) => (
          <div
            key={track.id}
            className="flex items-center justify-between bg-purple-900 bg-opacity-30 p-3 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <img
                src={track.cover_url}
                alt={track.title}
                className="w-14 h-14 object-cover rounded-md"
              />
              <div>
                <p className="font-semibold">{track.title}</p>
                <p className="text-sm text-gray-400">{track.artist}</p>
              </div>
            </div>

            <button
              onClick={() => handlePlaySingle(index)}
              className="text-white text-xl hover:text-yellow-400 transition"
            >
              ▶
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
