'use client';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import PlaylistCard from '../../components/PlaylistCard';

export default function SearchPage(){
  const [q,setQ] = useState('');
  const [results,setResults] = useState<any[]>([]);
  const [loading,setLoading] = useState(false);

  async function onSearch(val:string){
    setQ(val); setLoading(true);
    const sb = getSupabaseClient();
    if(!sb){ setResults([]); setLoading(false); return; }
    const { data } = await sb.from('playlists')
      .select('id,external_id,title,description,cover_url,region,channel_title,view_count,item_count,last_refreshed_on')
      .ilike('title', `%${val}%`)
      .limit(30);
    setResults(data||[]); setLoading(false);
  }

  useEffect(()=>{ onSearch(''); },[]);
  return (
    <>
      <input className="search" placeholder="Search playlists…" value={q} onChange={e=>onSearch(e.target.value)} />
      <div style={{height:8}}/>
      <div className="kwrap">
        {['Most popular','Trending now','Best of 80s','Best of 90s','Best of 2000s'].map(k=>
          <span key={k} className="kpill">{k}</span>
        )}
      </div>
      <div style={{height:10}}/>
      {loading && <div className="muted">Searching…</div>}
      <div className="grid playlists">
        {results.map(p=> <PlaylistCard key={p.id} pl={p} />)}
      </div>
    </>
  );
}
