import PlaylistCard from './PlaylistCard'
import type { Playlist } from '../lib/categories'

export default function CategoryRow({ title, playlists }: { title: string; playlists: Playlist[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
        {playlists.map((p) => (
          <div className="w-44 shrink-0 snap-start" key={p.id}>
            <PlaylistCard title={p.title} region={p.region} cover={p.cover} />
          </div>
        ))}
      </div>
    </section>
  )
}
