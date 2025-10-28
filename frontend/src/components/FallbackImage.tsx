import React from 'react';
import Image from 'next/image';

type Props = React.ComponentProps<typeof Image> & { fallback?: string };

export default function FallbackImage({ src, fallback = '/images/fallback-cover.jpg', alt, ...rest }: Props) {
  const [s, setS] = React.useState<string | undefined>(typeof src === 'string' ? src : undefined);

  React.useEffect(() => {
    if (typeof src === 'string') setS(src);
  }, [src]);

  return (
    // @ts-ignore - pass through to Next/Image
    <Image
      src={s || fallback}
      alt={String(alt || '')}
      onError={() => setS(fallback)}
      {...(rest as any)}
    />
  );
}
