import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import { supportedLngs } from '@/i18n/config';

export default function Header() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { language, setLanguage } = useUser();

  const languageNames: Record<string, string> = {
    en: 'English', sr: 'Srpski', hu: 'Magyar', hi: 'हिन्दी',
    vi: 'Tiếng Việt', ko: '한국어', am: 'Amharic', ng: 'Ndonga', id: 'Bahasa Indonesia',
    fil: 'Filipino', ms: 'Bahasa Melayu', ur: 'اردو', bn: 'বাংলা', th: 'ไทย', ru: 'Русский',
    pt: 'Português', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano',
    nl: 'Nederlands', pl: 'Polski', cs: 'Čeština', el: 'Ελληνικά'
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 w-full bg-[#0b0010] border-b border-[#3b0066]/60 shadow-[0_1px_0_#3b0066_inset]">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-purple-600 via-fuchsia-500 to-amber-300 shadow-md" aria-hidden />
          <h1 className="text-lg sm:text-xl font-semibold tracking-wide">
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">Purple Music</span>
          </h1>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="h-9 w-9 rounded-full bg-purple-900/30 border border-purple-700/40 flex items-center justify-center text-purple-200 hover:bg-purple-800/40 focus:outline-none"
          >
            <span className="sr-only">Open profile menu</span>
            {/* simple avatar dot */}
            <div className="h-3 w-3 rounded-full bg-purple-300" />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 rounded-md bg-[#0b0010] border border-purple-800/50 shadow-xl p-2 text-sm text-gray-200"
            >
              <div className="px-3 py-2 rounded items-center flex justify-between">
                <span className="opacity-90">{t('header.signedInAs')}</span>
                <span className="font-medium text-purple-300">{t('header.guest')}</span>
              </div>
              <div className="my-2 h-px bg-purple-800/40" />
              <div className="px-3 py-2">
                <label htmlFor="lang" className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{t('header.language')}</label>
                <select
                  id="lang"
                  value={String(language)}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-transparent border border-purple-800/50 rounded px-2 py-1 focus:outline-none"
                >
                  {supportedLngs.map((lng) => (
                    <option key={lng} className="bg-[#0b0010]" value={lng}>
                      {languageNames[lng as string] || lng}
                    </option>
                  ))}
                </select>
              </div>
              <div className="my-2 h-px bg-purple-800/40" />
              <div className="px-3 py-2 text-purple-200">{t('header.goPremium')}</div>
              <div className="my-2 h-px bg-purple-800/40" />
              <Link href="/privacy" className="block px-3 py-2 hover:bg-purple-900/30 rounded" role="menuitem">{t('header.privacy')}</Link>
              <Link href="/terms" className="block px-3 py-2 hover:bg-purple-900/30 rounded" role="menuitem">{t('header.terms')}</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
