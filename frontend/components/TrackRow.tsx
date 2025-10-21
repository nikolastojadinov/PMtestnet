'use client';
export default function TrackRow({ track, onPlay }:{track:any; onPlay:()=>void}){
  return (
    <div className="row space" style={{borderBottom:'1px solid var(--line)', padding:'10px 4px'}}>
      <div className="row" style={{gap:10}}>
        {track.cover_url && <img src={track.cover_url} width={44} height={44} style={{borderRadius:6,objectFit:'cover'}} alt=""/>}
        <div>
          <div style={{fontWeight:700}}>{track.title}</div>
          <div className="muted" style={{fontSize:12}}>{track.artist || 'YouTube'}</div>
        </div>
      </div>
      <div className="row" style={{gap:8}}>
        <button className="kpill" onClick={onPlay}>▶ Play</button>
        <button className="kpill">❤️ Like</button>
        <button className="kpill">➕ Add</button>
      </div>
    </div>
  );
}
