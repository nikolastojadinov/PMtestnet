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
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
