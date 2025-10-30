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
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#0a0014] border-t border-purple-900/40">
      <ul className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-4 gap-2 text-xs text-gray-300">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex justify-center">
              <motion.a
                href={href}
                onClick={(e) => { e.preventDefault(); router.push(href); }}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-md transition-colors transition-transform ${
                  active
                    ? 'text-purple-400'
                    : 'text-gray-400 hover:text-gray-200'
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
