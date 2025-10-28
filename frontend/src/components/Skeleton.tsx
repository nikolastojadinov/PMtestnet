import React from 'react';

// Simple reusable skeletons with shimmer
export function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded bg-[#1a0024] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export function SkeletonText({ width = 'w-3/4' }: { width?: string }) {
  return <div className={`h-3 ${width} rounded bg-white/10`} />;
}

export function PlaylistTileSkeleton({ large = false }: { large?: boolean }) {
  return (
    <div className={`rounded-lg overflow-hidden bg-[#120018] border border-purple-800/40 ${large ? 'w-full' : 'min-w-[160px] w-[180px]'}`}>
      <SkeletonBox className={`${large ? 'aspect-[16/9]' : 'aspect-square'} w-full`} />
      <div className="p-3 space-y-2">
        <SkeletonText width="w-5/6" />
        <SkeletonText width="w-1/3" />
      </div>
    </div>
  );
}

export function TrackRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <SkeletonBox className="h-12 w-12" />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonText width="w-2/3" />
        <SkeletonText width="w-1/3" />
      </div>
      <div className="flex items-center gap-2">
        <SkeletonBox className="h-8 w-8 rounded" />
        <SkeletonBox className="h-8 w-8 rounded" />
        <SkeletonBox className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}

export function SearchResultSkeleton() {
  return (
    <div className="w-full px-3 py-2 flex items-center gap-3">
      <SkeletonBox className="h-10 w-10 rounded" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonText width="w-3/4" />
        <SkeletonText width="w-1/4" />
      </div>
    </div>
  );
}
