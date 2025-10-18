import PlaylistCard from './PlaylistCard'
import type { Playlist } from '../lib/categories'

export default function CategoryRow({ title, playlists }: { title: string; playlists: Playlist[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {playlists.map((p) => (
          <PlaylistCard key={p.id} title={p.title} region={p.region} />
        ))}
      </div>
    </section>
  )
}
