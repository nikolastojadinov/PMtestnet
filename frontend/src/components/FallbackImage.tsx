import React from 'react';
import Image, { type ImageProps } from 'next/image';

type Props = ImageProps & { fallback?: string };

export default function FallbackImage({ src, alt, fallback = '/images/fallback-cover.jpg', className, ...rest }: Props) {
  const [useFallback, setUseFallback] = React.useState(false);

  React.useEffect(() => {
    setUseFallback(false);
  }, [src]);

  const displaySrc = useFallback ? fallback : src;
  const mergedClass = [
    'w-full h-auto aspect-square object-cover rounded-lg transition-transform duration-200 hover:scale-105',
    className || ''
  ].join(' ').trim();

  return (
    <Image
      {...rest}
      src={displaySrc}
      alt={String(alt || 'playlist cover')}
      onError={() => setUseFallback(true)}
      className={mergedClass}
    />
  );
}
