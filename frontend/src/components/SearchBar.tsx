import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export type SearchResult = {
  id: string;
  title: string;
  cover_url: string | null;
  region: string | null;
  category: string | null;
};

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('id, title, cover_url, region, category')
          .ilike('title', `%${query}%`)
          .limit(10);
        if (error) throw error;
        setResults(data as SearchResult[]);
        setOpen(true);
      } catch (err) {
        console.warn('Search error', err);
        setResults([]);
        setOpen(false);
      }
    }, 300);
  }, [query]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search playlists..."
        className="w-full rounded-md bg-[#13001a] border border-purple-800/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-600"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-md bg-[#0b0010] border border-purple-800/50 shadow-xl max-h-80 overflow-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => router.push(`/playlist/${r.id}`)}
              className="w-full px-3 py-2 text-left hover:bg-purple-900/30 flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded bg-[#1a0024] overflow-hidden flex items-center justify-center">
                {r.cover_url ? (
                  <img src={r.cover_url} alt={r.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-6 w-6 rounded bg-purple-700/40" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm text-gray-200">{r.title}</div>
                <div className="text-xs text-gray-400 truncate">{r.region || r.category || 'Playlist'}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
