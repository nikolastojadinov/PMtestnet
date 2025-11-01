import React from 'react';
import { useRouter } from 'next/router';
import FallbackImage from './FallbackImage';

interface PlaylistCardProps {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
}

export default function PlaylistCard({ id, title, description, cover_url }: PlaylistCardProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/playlist/${id}`)}
      className="flex flex-col items-center cursor-pointer w-[42vw] sm:w-48 md:w-56 lg:w-60 transition-transform hover:scale-105"
    >
      <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 shadow-lg bg-[#181818] border border-[#2a2a2a]">
        <FallbackImage
          src={cover_url || '/images/fallback-cover.jpg'}
          alt={title}
          className="w-full h-full object-cover aspect-square rounded-xl"
        />
      </div>
      <div className="text-center w-full text-white">
        <div className="font-semibold truncate">{title}</div>
        {description && <div className="text-sm opacity-70 truncate">{description}</div>}
      </div>
    </div>
  );
}
