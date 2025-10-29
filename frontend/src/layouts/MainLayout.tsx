/**
 * This file is a modified version of a file from the OKV-Music project.
 * Original project: https://github.com/onamkrverma/okv-music
 * Licensed under the Mozilla Public License 2.0 (MPL-2.0).
 * Modifications © 2025 Purple Music Team.
 */
import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen transition-colors duration-300 bg-[#fafafa] text-[#111111] dark:bg-[#090010] dark:text-gray-200">
      <Header />
      <div className="pt-16 pb-20 max-w-6xl mx-auto px-4">
        {children}
      </div>
      <Footer />
    </div>
  );
}
