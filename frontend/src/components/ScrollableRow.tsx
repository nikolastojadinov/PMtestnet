import React from 'react';
import PlaylistCard from './PlaylistCard';

type Playlist = { id: string; title: string; description?: string; cover_url?: string | null };

type Props = {
  title: string;
  playlists: Playlist[];
};

export default function ScrollableRow({ title, playlists }: Props) {
  return (
    <section className="mb-10">
      <h2 className="text-xl md:text-2xl font-semibold mb-4 px-2 bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">
        {title}
      </h2>
      <div className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory px-2 pb-2 scrollbar-hide">
        {playlists.map((p) => (
          <div key={p.id} className="snap-start">
            <PlaylistCard id={p.id} title={p.title} description={p.description} cover_url={p.cover_url || undefined} />
          </div>
        ))}
      </div>
    </section>
  );
}
