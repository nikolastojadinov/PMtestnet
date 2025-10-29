import type { AppProps } from 'next/app';
import '@/styles/globals.css';
// player.css removed; all player styles now in Tailwind classes
import { PlayerProvider } from '@/context/PlayerContext';
import MainLayout from '@/layouts/MainLayout';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import Script from 'next/script';
import { UserProvider } from '@/context/UserContext';
import { ThemeProvider } from '@/context/ThemeContext';
import Head from 'next/head';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Purple Music</title>
        <meta name="description" content="Curated YouTube music playlists with a sleek purple theme." />
        <meta name="theme-color" content="#3b0066" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <meta property="og:title" content="Purple Music" />
        <meta property="og:description" content="Curated YouTube music playlists with a sleek purple theme." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={process.env.NEXT_PUBLIC_FRONTEND_URL || ''} />
        <meta property="og:image" content="/icons/icon-512.svg" />
      </Head>
      <Script id="pi-sdk" src="https://sdk.minepi.com/pi-sdk.js" strategy="lazyOnload" />
      <ThemeProvider>
        <UserProvider>
          <PlayerProvider>
            <MainLayout>
              <Component {...pageProps} />
            </MainLayout>
          </PlayerProvider>
        </UserProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
