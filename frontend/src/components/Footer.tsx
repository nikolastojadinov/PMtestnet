import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home as HomeIcon, Search, Heart, ListMusic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const tabs = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/liked', label: 'Liked', icon: Heart },
  { href: '/playlists', label: 'Playlists', icon: ListMusic },
];

export default function Footer() {
  const router = useRouter();
  const pathname = router.pathname;
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 transition-colors duration-300 bg-white/80 backdrop-blur-md border-t border-purple-200 shadow-[0_-1px_0_#e9e9e9_inset] dark:bg-[#0b0010]/70 dark:border-[#3b0066]/60 dark:shadow-[0_-1px_0_#3b0066_inset]">
      <ul className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-4 gap-2 text-xs">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex justify-center">
              <motion.a
                href={href}
                onClick={(e) => { e.preventDefault(); router.push(href); }}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-md transition-colors transition-transform ${
                  active
                    ? 'text-purple-700 dark:text-purple-300 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]'
                    : 'text-gray-600 hover:text-[#111111] dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.05 }}
              >
                <Icon size={22} strokeWidth={1.75} />
                <span>{t(`footer.${label.toLowerCase()}`)}</span>
              </motion.a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
