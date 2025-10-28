import React from 'react';

export default function Header() {
  return (
    <header className="sticky top-0 z-20 w-full bg-black/40 backdrop-blur border-b border-pm-purple/40">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-wide">
          <span className="text-pm-accent">Purple</span> Music
        </h1>
        <nav className="text-sm opacity-80 hover:opacity-100 transition">
          <a href="/" className="mr-4 hover:text-pm-accent">Home</a>
          <a href="/about" className="hover:text-pm-accent">About</a>
        </nav>
      </div>
    </header>
  );
}
