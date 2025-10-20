import PlaylistCard from './PlaylistCard'

type Row = { id: string; title: string; region?: string | null; cover_url?: string | null }

export default function PlaylistRow({ title, playlists }: { title: string; playlists: Row[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
        {playlists.map((p) => (
          <div className="w-44 shrink-0 snap-start" key={p.id}>
            <PlaylistCard id={p.id} title={p.title} region={p.region || ''} cover={p.cover_url || '/covers/readme.txt'} />
          </div>
        ))}
      </div>
    </section>
  )
}
