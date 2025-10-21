"use client";

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import PlaylistCard from '../components/PlaylistCard';
import PremiumPopup from '../components/PremiumPopup';
import { loginWithPi } from '../lib/pi-login';

export default function HomePage(){
  const [recent, setRecent] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);

  useEffect(()=>{ loginWithPi().catch(()=>{}); },[]);

  useEffect(()=>{
    // 1) poslednje osvežene (proxy za "recent listens" dok ne dodamo user history)
    getSupabaseClient()?.from('v_playlists_full').select('*').order('last_refreshed_on',{ascending:false}).limit(8)
      .then(({data})=> setRecent(data||[]));
    // 2) popular po view_count
    getSupabaseClient()?.from('v_playlists_full').select('*').order('view_count',{ascending:false}).limit(8)
      .then(({data})=> setPopular(data||[]));
    // 3) trending po item_count i skor
    getSupabaseClient()?.from('v_playlists_full').select('*').order('quality_score',{ascending:false}).order('item_count',{ascending:false}).limit(8)
      .then(({data})=> setTrending(data||[]));
  },[]);

  return (
    <>
      <div className="row space" style={{marginBottom:12}}>
        <div className="row" style={{gap:8}}>
          <div className="h1">Purple Music</div>
          <span className="badge">BETA</span>
        </div>
        <a className="kpill" href="/search/">🔍 Search</a>
      </div>

      <section style={{marginBottom:18}}>
        <div className="h2">Recently refreshed</div>
        <div className="grid playlists">
          {recent.map(p => <PlaylistCard key={p.id} pl={p} />)}
        </div>
      </section>

      <section style={{marginBottom:18}}>
        <div className="h2">Most popular</div>
        <div className="grid playlists">
          {popular.map(p => <PlaylistCard key={p.id} pl={p} />)}
        </div>
      </section>

      <section>
        <div className="h2">Trending now</div>
        <div className="grid playlists">
          {trending.map(p => <PlaylistCard key={p.id} pl={p} />)}
        </div>
      </section>

      <PremiumPopup />
    </>
  );
}
