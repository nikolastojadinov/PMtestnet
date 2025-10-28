"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '@/i18n/config';
import { supabase } from '@/lib/supabaseClient';
import { supportedLngs } from '@/i18n/config';

type Lang = (typeof supportedLngs)[number] | string;

type UserCtx = {
  language: Lang;
  setLanguage: (lang: Lang) => void;
};

const Ctx = createContext<UserCtx | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Lang>('en');

  const detectInitial = useCallback(async () => {
    // 1) localStorage
    const ls = typeof window !== 'undefined' ? localStorage.getItem('pm_lang') : null;
    if (ls) return ls;
    // 2) Supabase (mock user "Guest")
    try {
      const { data } = await supabase.from('users').select('language').eq('user_id', 'Guest').maybeSingle();
      if (data?.language) return data.language as string;
    } catch {}
    // 3) Pi Browser language or navigator.language
    const navLang = typeof navigator !== 'undefined' ? (navigator.language || 'en') : 'en';
    const short = navLang.split('-')[0];
    return supportedLngs.includes(short as any) ? short : 'en';
  }, []);

  useEffect(() => {
    (async () => {
      const initial = await detectInitial();
      setLanguageState(initial);
      i18n.changeLanguage(initial);
    })();
  }, [detectInitial]);

  const setLanguage = useCallback(async (lang: Lang) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') localStorage.setItem('pm_lang', String(lang));
    try {
      await supabase.from('users').upsert({ user_id: 'Guest', language: String(lang) }, { onConflict: 'user_id' });
    } catch {}
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUser() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
