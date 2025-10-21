'use client';
import Link from 'next/link';
export default function FooterNav(){
  return (
    <div className="footer">
      <nav className="container">
        <Link href="/">🏠 Home</Link>
        <Link href="/search/">🔍 Search</Link>
        <Link href="/liked/">❤️ Liked</Link>
        <Link href="/mine/">🎶 My Playlists</Link>
      </nav>
    </div>
  );
}
