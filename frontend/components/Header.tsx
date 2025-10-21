'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Header(){
  const [premium,setPremium] = useState<string| null>(null);
  useEffect(()=>{
    // backend can return user with premium_until
    const s = sessionStorage.getItem('pm_user');
    if(s){ try{ const u=JSON.parse(s); if(u?.premium_until) setPremium(u.premium_until);}catch{} }
  },[]);
  return (
    <header className="header">
      <div className="container row space" style={{padding:'12px 16px'}}>
        <Link href="/"><div className="row" style={{gap:10}}>
          <div style={{width:28,height:28,borderRadius:8,background:'var(--purple)'}}/>
          <strong>Purple Music</strong>
        </div></Link>
        <div className="row" style={{gap:12}}>
          {premium ? <span className="badge">Premium until {new Date(premium).toLocaleDateString()}</span> : <Link className="kpill" href="/search/">Go Premium</Link>}
        </div>
      </div>
    </header>
  );
}
