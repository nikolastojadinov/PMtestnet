import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(url, anon)

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id, title, description, cover_url, region, category, item_count, channel_title, created_at')
    .eq('id', id)
    .single()

  if (!playlist) return notFound()

  return (
    <main className="min-h-screen bg-[#0d001a] text-white p-6">
      <h1 className="text-2xl font-semibold text-purple-200">{playlist.title}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={playlist.cover_url || 'https://placehold.co/200x200/6b21a8/ffffff?text=No+Cover'}
        alt={playlist.title}
        className="w-[200px] rounded-md mt-4"
      />
      <div className="mt-4 text-white/80">
        <p>{playlist.description || 'No description available.'}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/70">
          <div><span className="text-white/50">Region:</span> {playlist.region || '—'}</div>
          <div><span className="text-white/50">Category:</span> {playlist.category || '—'}</div>
          <div><span className="text-white/50">Items:</span> {playlist.item_count ?? '—'}</div>
          <div><span className="text-white/50">Channel:</span> {playlist.channel_title || '—'}</div>
        </div>
      </div>
    </main>
  )
}
