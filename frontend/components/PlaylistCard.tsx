export default function PlaylistCard({ title, region }: { title: string; region: string }) {
  return (
    <div className="group overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 hover:ring-white/20 transition">
      <div className="relative aspect-square w-full bg-gradient-to-br from-purple-700/60 to-yellow-300/40" />
      <div className="p-3">
        <div className="text-sm font-medium text-white line-clamp-1">{title}</div>
        <div className="text-xs text-white/60">{region}</div>
      </div>
    </div>
  )
}
