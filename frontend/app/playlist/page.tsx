"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '../../lib/supabase';
import TrackRow from '../../components/TrackRow';
import Player from '../../components/Player';

function PlaylistClient(){
  const params = useSearchParams();
  const id = params.get('id') || '';
  const [pl,setPl] = useState<any>(null);
  const [tracks,setTracks] = useState<any[]>([]);
  const [current,setCurrent] = useState<any|null>(null);
  const [show,setShow] = useState(false);

  useEffect(()=>{
    if(!id) return;
    (async ()=>{
      const sb = getSupabaseClient();
      if(!sb) return;
      const { data: p } = await sb.from('playlists').select('*').eq('id', id).single();
      setPl(p);
      const { data: pts, error: rpcErr } = await sb.rpc('get_playlist_tracks', { p_playlist_id: id });
      if(!rpcErr && pts){ setTracks(pts as any[]); }
      else {
        const { data: joined } = await sb.from('playlist_tracks')
          .select('position, tracks(id, external_id, title, artist, cover_url)')
          .eq('playlist_id', id).order('position',{ascending:true});
        const mapped = (joined||[]).map((r:any)=> ({ position:r.position, ...r.tracks }));
        setTracks(mapped);
      }
    })();
  },[id]);

  if(!id) return <div className="muted">No playlist selected.</div>;

  return (
    <>
      {pl && (
        <div className="card" style={{padding:12, marginBottom:12}}>
          <div className="row">
            {pl.cover_url && <img src={pl.cover_url} alt="" width={84} height={84} style={{borderRadius:8,objectFit:'cover'}} />}
            <div>
              <div className="h2">{pl.title}</div>
              <div className="muted">{pl.channel_title} • {pl.item_count ?? tracks.length} tracks</div>
              <div className="row" style={{gap:8, marginTop:8}}>
                <button className="cta" onClick={()=>{ setCurrent(tracks[0]); setShow(true); }}>▶ Play All</button>
                <a className="ghost" target="_blank" rel="noreferrer" href={`https://www.youtube.com/playlist?list=${pl.external_id}`}>Open on YouTube</a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        {tracks.map((t:any, i:number)=> (
          <TrackRow key={t.id||i} track={t} onPlay={()=>{ setCurrent(t); setShow(true); }} />
        ))}
      </div>

      {show && current && <Player videoId={current.external_id} title={current.title} onClose={()=>setShow(false)} />}
    </>
  );
}

export default function PlaylistPage(){
  return (
    <Suspense fallback={<div className="muted">Loading…</div>}>
      <PlaylistClient />
    </Suspense>
  );
}
