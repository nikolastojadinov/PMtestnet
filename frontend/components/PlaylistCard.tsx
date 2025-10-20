import Link from 'next/link'

export default function PlaylistCard({ id, title, region, cover }: { id: string; title: string; region: string; cover: string }) {
  return (
    <Link href={`/playlist/${id}`} className="group block overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 hover:ring-white/20 transition">
      <div className="aspect-square overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold text-white line-clamp-1">{title}</div>
        <div className="text-xs text-white/60">{region}</div>
      </div>
    </Link>
  )
}
