import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { PlayerProvider } from '@/context/PlayerContext';
import MainLayout from '@/layouts/MainLayout';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <PlayerProvider>
      <MainLayout>
        <Component {...pageProps} />
      </MainLayout>
    </PlayerProvider>
  );
}
