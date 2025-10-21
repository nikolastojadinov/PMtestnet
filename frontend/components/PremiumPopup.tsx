'use client';
import { useEffect, useState } from 'react';
export default function PremiumPopup(){
  const [show,setShow]=useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setShow(true),1200); return ()=>clearTimeout(t); },[]);
  if(!show) return null;
  return (
    <div style={{position:'fixed',right:16,bottom:86,background:'var(--bg2)',border:'1px solid var(--line)',borderRadius:12,padding:12,width:280,zIndex:40}}>
      <div className="h2">Go Premium</div>
      <div className="muted" style={{fontSize:13,margin:'6px 0 10px'}}>Enjoy ad-free experience and extra features. Visible for 5s, never covers the YouTube player.</div>
      <div className="row" style={{gap:8}}>
        <button className="cta" onClick={()=>setShow(false)}>1 π / week</button>
        <button className="ghost" onClick={()=>setShow(false)}>Not now</button>
      </div>
    </div>
  );
}
