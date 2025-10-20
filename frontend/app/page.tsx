import { categories, recentlyPlayed } from '../lib/categories'
import CategoryRow from '../components/CategoryRow'
import PlaylistCard from '../components/PlaylistCard'

export default function Page() {
  return (
    <div className="space-y-10">
      {/* Search */}
      <section>
        <div className="relative">
          <input
            placeholder="Search for playlists, artists, or songs"
            className="w-full rounded-full bg-white/5 border border-white/10 px-5 py-3 outline-none focus:border-[#6C2BD9] focus:shadow-[0_0_0_3px_rgba(108,43,217,0.35)] transition"
          />
        </div>
      </section>

      {/* Recently Played grid: 2 columns x 4 rows */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recently Played</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {recentlyPlayed.slice(0, 8).map((p) => (
            <PlaylistCard key={p.id} title={p.title} region={p.region} cover={p.cover} />
          ))}
        </div>
      </section>

      {/* Categories - horizontal rows */}
      {categories.map((c) => (
        <CategoryRow key={c.id} title={c.title} playlists={c.playlists} />
      ))}
    </div>
  )
}
