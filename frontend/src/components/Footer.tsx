import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-pm-purple/40 mt-12">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs opacity-70">
        <p>
          © {new Date().getFullYear()} Purple Music. UI base derived from OKV-Music (MPL-2.0).
        </p>
      </div>
    </footer>
  );
}
