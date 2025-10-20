import { HomeIcon, MagnifyingGlassIcon, HeartIcon, ListBulletIcon } from '@heroicons/react/24/outline'

const NavItem = ({ active, children }: { active?: boolean; children: React.ReactNode }) => (
  <button className={`flex flex-col items-center gap-1 ${active ? 'text-[#6C2BD9]' : 'text-white/70 hover:text-white'}`}>
    {children}
  </button>
)

export default function Footer() {
  return (
    <footer className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-black/60 backdrop-blur">
      <nav className="mx-auto max-w-6xl px-6 py-2 grid grid-cols-4 gap-2">
        <NavItem active>
          <HomeIcon className="w-6 h-6" />
          <span className="text-xs">Home</span>
        </NavItem>
        <NavItem>
          <MagnifyingGlassIcon className="w-6 h-6" />
          <span className="text-xs">Search</span>
        </NavItem>
        <NavItem>
          <HeartIcon className="w-6 h-6" />
          <span className="text-xs">Liked</span>
        </NavItem>
        <NavItem>
          <ListBulletIcon className="w-6 h-6" />
          <span className="text-xs">My Playlists</span>
        </NavItem>
      </nav>
    </footer>
  )
}
