import React from 'react';
import Image, { type ImageProps } from 'next/image';

type Props = Omit<ImageProps, 'src' | 'alt'> & {
  src?: string | null;
  alt?: string;
  fallback?: string;
};

export default function FallbackImage({ src, alt, fallback = '/images/fallback-cover.jpg', className, ...rest }: Props) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const mergedClass = [
    'w-full h-auto aspect-square object-cover rounded-lg transition-transform duration-200 hover:scale-105',
    className || ''
  ].join(' ').trim();

  // If no src or image failed and no fallback provided, render a placeholder card
  const showPlaceholder = !src || failed;

  if (showPlaceholder && !fallback) {
    return (
      <div className={["w-full aspect-square rounded-lg bg-gradient-to-br from-purple-900/70 to-purple-700/50 flex items-center justify-center", className || ''].join(' ').trim()}>
        {/* Simple music note placeholder */}
        <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-purple-200/80">
          <path d="M12 3v10.55A4 4 0 1 1 10 17V7h10V3h-8z" />
        </svg>
      </div>
    );
  }

  const finalSrc = showPlaceholder ? (fallback || '') : (src as string);

  if (showPlaceholder && fallback) {
    return (
      <Image
        {...rest}
        src={finalSrc}
        alt={String(alt || 'playlist cover')}
        loading="lazy"
        onError={() => setFailed(true)}
        className={mergedClass}
      />
    );
  }

  return (
    <Image
      {...rest}
      src={finalSrc}
      alt={String(alt || 'playlist cover')}
      loading="lazy"
      onError={() => setFailed(true)}
      className={mergedClass}
    />
  );
}
