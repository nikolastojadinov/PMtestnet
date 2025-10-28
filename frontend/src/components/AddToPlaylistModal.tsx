import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  open: boolean;
  onClose: () => void;
  trackId: string | number | null;
};

type Playlist = {
  id: string | number;
  title: string;
};

export default function AddToPlaylistModal({ open, onClose, trackId }: Props) {
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Mock user "Guest": try several common columns
        const { data, error } = await supabase
          .from('playlists')
          .select('id, title')
          .or('owner.eq.Guest,user_id.eq.Guest,created_by.eq.Guest')
          .limit(20);
        if (error) throw error;
        setPlaylists((data || []) as Playlist[]);
      } catch (e: any) {
        console.warn('fetch playlists for modal', e?.message || e);
        setPlaylists([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  async function addTo(playlistId: string | number) {
    if (!trackId) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from('playlist_tracks').insert({
        playlist_id: playlistId,
        track_id: trackId,
        added_at: new Date().toISOString(),
      });
      if (error) throw error;
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to add to playlist');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg bg-[#0b0010] border border-purple-800/50 shadow-2xl">
        <div className="p-4 border-b border-purple-800/40">
          <h3 className="text-lg font-semibold">Add to Playlist</h3>
        </div>
        <div className="p-4 space-y-3">
          {loading && <div className="text-sm text-gray-400">Loading...</div>}
          {error && <div className="text-sm text-red-400">{error}</div>}
          {!loading && playlists.length === 0 && (
            <div className="text-sm text-gray-400">No playlists yet.</div>
          )}
          {!loading && playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => addTo(pl.id)}
              className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-purple-900/30"
            >
              <span className="truncate">{pl.title}</span>
              <span className="text-xs text-purple-300">Add</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-purple-800/40 flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-purple-800/40 hover:bg-purple-700/40">Close</button>
        </div>
      </div>
    </div>
  );
}
