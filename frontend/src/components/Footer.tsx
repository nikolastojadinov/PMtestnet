import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home as HomeIcon, Search, Heart, ListMusic } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#0b0010] border-t border-[#3b0066]/60 shadow-[0_-1px_0_#3b0066_inset]">
      <ul className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-4 gap-2 text-xs">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex justify-center">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-md transition-colors ${
                  active
                    ? 'text-purple-300 drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={22} strokeWidth={1.75} />
                <span>{t(`footer.${label.toLowerCase()}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
