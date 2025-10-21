'use client';
import Link from 'next/link';
export default function PlaylistCard({ pl }:{pl:any}){
  return (
    <Link href={`/playlist/?id=${encodeURIComponent(pl.id)}`}>
      <div className="card">
        {pl.cover_url && <img src={pl.cover_url} alt="" width="100%" height="160" style={{objectFit:'cover'}}/>}
        <div style={{padding:10}}>
          <div className="h2" style={{marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{pl.title}</div>
          <div className="muted" style={{fontSize:12}}>{pl.channel_title || 'YouTube'} • {pl.item_count ?? 0} tracks</div>
        </div>
      </div>
    </Link>
  );
}
