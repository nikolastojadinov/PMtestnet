import { UserCircleIcon } from '@heroicons/react/24/outline'

export default function Header() {
  return (
    <header className="sticky top-0 z-20 bg-black/60 backdrop-blur border-b border-white/10">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold bg-gradient-to-r from-purple-500 to-yellow-300 bg-clip-text text-transparent">Purple Music</h1>
        <button className="text-white/80 hover:text-white transition-opacity" aria-label="Profile">
          <UserCircleIcon className="w-7 h-7" />
        </button>
      </div>
    </header>
  )
}
