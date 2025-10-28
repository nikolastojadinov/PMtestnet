import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  title: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
};

export default function ScrollableRow({ title, loading, children }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8) * dir;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <section className="space-y-3 group">
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.25 }}
        className="text-base md:text-lg font-semibold bg-gradient-to-r from-purple-400 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent"
      >
        {title}
      </motion.h3>
      <div className="relative">
        {/* left */}
        <button
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full bg-black/40 border border-purple-800/50 text-purple-100 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
        >
          <ChevronLeft size={18} />
        </button>
        {/* right */}
        <button
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full bg-black/40 border border-purple-800/50 text-purple-100 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
        >
          <ChevronRight size={18} />
        </button>

        <div
          ref={ref}
          className="flex gap-4 pr-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
      </div>
    </section>
  );
}
