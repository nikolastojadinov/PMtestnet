import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import { supportedLngs } from '@/i18n/config';
import { useTheme } from '@/context/ThemeContext';
import { Monitor, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  <header className="fixed top-0 inset-x-0 z-50 w-full transition-colors duration-300 bg-white/80 backdrop-blur-md text-[#111111] border-b border-purple-200 dark:bg-[#0b0010]/70 dark:text-gray-200 dark:border-[#3b0066]/60 shadow-[0_1px_0_#e9e9e9_inset] dark:shadow-[0_1px_0_#3b0066_inset]">
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

          <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 mt-2 w-72 rounded-md transition-colors duration-300 bg-white text-[#111111] border border-purple-200 shadow-xl p-2 text-sm dark:bg-[#0b0010] dark:text-gray-200 dark:border-purple-800/50"
            >
              <div className="px-3 py-2 rounded items-center flex justify-between">
                <span className="opacity-90">{t('header.signedInAs')}</span>
                <span className="font-medium text-purple-300">{t('header.guest')}</span>
              </div>
              <div className="px-3 text-xs text-gray-400">Guest User (temporary session)</div>
              <div className="my-2 h-px bg-purple-800/40" />
              <div className="px-3 py-2">
                <label htmlFor="lang" className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{t('header.language')}</label>
                <select
                  id="lang"
                  value={String(language)}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-transparent border border-purple-300 dark:border-purple-800/50 rounded px-2 py-1 focus:outline-none"
                >
                  {supportedLngs.map((lng) => (
                    <option key={lng} className="bg-white dark:bg-[#0b0010]" value={lng}>
                      {languageNames[lng as string] || lng}
                    </option>
                  ))}
                </select>
              </div>
              {/* Theme selector */}
              <ThemeSelector />
              <div className="my-2 h-px bg-purple-800/40" />
              <div className="px-3 py-2 text-purple-700 dark:text-purple-200">{t('header.goPremium')}</div>
              <div className="my-2 h-px bg-purple-800/40" />
              <Link href="/privacy.html" className="block px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded" role="menuitem">{t('header.privacy')}</Link>
              <Link href="/terms.html" className="block px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded" role="menuitem">{t('header.terms')}</Link>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function ThemeSelector() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <div className="px-3 py-2" aria-label={t('theme.title')}>
      <div className="block text-xs uppercase tracking-wider text-gray-400 mb-2">{t('theme.title')}</div>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setTheme('system')}
          className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 border transition-colors duration-200
            ${theme === 'system' ? 'border-purple-500 text-purple-700 dark:text-purple-200' : 'border-purple-200 dark:border-purple-800/50 text-gray-700 dark:text-gray-200'}`}
          aria-label={t('theme.system')}
        >
          <Monitor size={16} />
          <span className="text-xs">{t('theme.system')}</span>
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 border transition-colors duration-200
            ${theme === 'dark' ? 'border-purple-500 text-purple-700 dark:text-purple-200' : 'border-purple-200 dark:border-purple-800/50 text-gray-700 dark:text-gray-200'}`}
          aria-label={t('theme.dark')}
        >
          <Moon size={16} />
          <span className="text-xs">{t('theme.dark')}</span>
        </button>
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 border transition-colors duration-200
            ${theme === 'light' ? 'border-purple-500 text-purple-700 dark:text-purple-200' : 'border-purple-200 dark:border-purple-800/50 text-gray-700 dark:text-gray-200'}`}
          aria-label={t('theme.light')}
        >
          <Sun size={16} />
          <span className="text-xs">{t('theme.light')}</span>
        </button>
      </div>
    </div>
  );
}
