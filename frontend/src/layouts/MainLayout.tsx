/**
 * This file is a modified version of a file from the OKV-Music project.
 * Original project: https://github.com/onamkrverma/okv-music
 * Licensed under the Mozilla Public License 2.0 (MPL-2.0).
 * Modifications © 2025 Purple Music Team.
 */
import React from 'react';
import Header from '../components/Header';
import dynamic from 'next/dynamic';

const FullPlayer = dynamic(() => import('@/components/FullPlayer'), { ssr: false });
const MiniPlayer = dynamic(() => import('@/components/MiniPlayer'), { ssr: false });

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#121212] text-gray-100">
      <Header />
      <div className="pt-16 pb-24 max-w-6xl mx-auto px-4">
        {children}
      </div>
  {/* Players */}
    <FullPlayer />
    <MiniPlayer />
    </div>
  );
}
