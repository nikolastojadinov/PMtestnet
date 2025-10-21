'use client';
import { useEffect } from 'react';
export default function Player({ videoId, title, onClose }:{videoId:string; title:string; onClose:()=>void}){
  useEffect(()=>{ document.body.style.overflow='hidden'; return ()=>{document.body.style.overflow='auto'}; },[]);
  return (
    <div className="player-fs">
      <div className="row space container" style={{padding:'10px 16px'}}>
        <div className="h2">{title}</div>
        <button className="kpill" onClick={onClose}>✕ Close</button>
      </div>
      {/* YouTube IFrame Player API - visible, unmodified */}
      <iframe
        className="player-iframe"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
      />
      <div className="container row" style={{gap:8, padding:'10px 16px'}}>
        <a className="ghost" target="_blank" rel="noreferrer" href={`https://www.youtube.com/watch?v=${videoId}`}>Open original on YouTube</a>
        <button className="kpill">❤️ Like</button>
        <button className="kpill">➕ Add to Playlist</button>
      </div>
    </div>
  );
}
