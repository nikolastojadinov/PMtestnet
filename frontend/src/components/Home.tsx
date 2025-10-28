import React from 'react';
import Player from './Player';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h2 className="text-2xl md:text-3xl font-semibold mb-6">Welcome to <span className="text-pm-accent">Purple</span> Music</h2>
      <p className="opacity-80 mb-8">A clean OKV-Music–inspired UI scaffold. Player below is always visible per Pi Browser rules.</p>
      <Player />
    </main>
  );
}
