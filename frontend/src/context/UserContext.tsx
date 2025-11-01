"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '@/i18n/config';
import { useGuestUser } from '@/hooks/useGuestUser';
import { supportedLngs } from '@/i18n/config';

type Lang = (typeof supportedLngs)[number] | string;

type UserCtx = {
  language: Lang;
  setLanguage: (lang: Lang) => void;
};

const Ctx = createContext<UserCtx | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Lang>('en');
  const { guest, ready } = useGuestUser();

  const detectInitial = useCallback(async () => {
    // 1) localStorage
    const ls = typeof window !== 'undefined' ? localStorage.getItem('pm_lang') : null;
    if (ls) return ls;
    // 2) Pi Browser language ili navigator.language
    const navLang = typeof navigator !== 'undefined' ? (navigator.language || 'en') : 'en';
    const short = navLang.split('-')[0];
    return supportedLngs.includes(short as any) ? short : 'en';
  }, [guest.id]);

  useEffect(() => {
    (async () => {
      const initial = await detectInitial();
      setLanguageState(initial);
      i18n.changeLanguage(initial);
    })();
  }, [detectInitial, ready]);

  const setLanguage = useCallback(async (lang: Lang) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') localStorage.setItem('pm_lang', String(lang));
    // WRITE onemogućen u YouTube-only režimu (READ-only frontend)
  }, [guest.id]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUser() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
