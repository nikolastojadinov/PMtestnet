import { categories } from '../lib/categories'
import CategoryRow from '../components/CategoryRow'

export default function Page() {
  return (
    <div className="space-y-10">
      {categories.map((c) => (
        <CategoryRow key={c.id} title={c.title} playlists={c.playlists} />
      ))}
    </div>
  )
}
