"use client"
import { useState } from 'react'
import { UserCircleIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import LanguageSelector from './shared/LanguageSelector'

export default function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="fixed top-0 inset-x-0 z-30 bg-black/50 backdrop-blur border-b border-white/10">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎵</span>
          <span className="text-lg font-semibold bg-gradient-to-r from-[#6C2BD9] to-[#FFD500] bg-clip-text text-transparent">
            Purple Music
          </span>
        </div>
        <div className="relative">
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 text-white/90 hover:text-white">
            <UserCircleIcon className="w-7 h-7" />
            <ChevronDownIcon className="w-4 h-4" />
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-black/80 backdrop-blur p-3 space-y-3">
              <div className="text-sm text-white/80">Signed in as <span className="font-medium">username</span></div>
              <div className="h-px bg-white/10" />
              <div className="space-y-1">
                <label className="text-xs text-white/60">Language</label>
                <LanguageSelector />
              </div>
              <button className="w-full rounded-md bg-gradient-to-r from-[#6C2BD9] to-[#FFD500] text-black font-semibold py-2">Go Premium</button>
              <div className="h-px bg-white/10" />
              <nav className="text-sm text-white/80 space-y-1">
                <a className="block hover:text-white" href="#">Privacy Policy</a>
                <a className="block hover:text-white" href="#">Terms of Service</a>
              </nav>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
