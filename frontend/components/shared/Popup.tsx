export default function Popup({ open, onClose }: { open: boolean; onClose?: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-black/90 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Go Premium</h3>
          <button className="text-white/70 hover:text-white" onClick={onClose}>✕</button>
        </div>
        <p className="text-white/80 text-sm">Unlock ad-free listening and high-quality audio. This is a static preview.</p>
        <button className="w-full rounded-md bg-gradient-to-r from-[#6C2BD9] to-[#FFD500] text-black font-semibold py-2">Subscribe</button>
      </div>
    </div>
  )
}
