import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { PlayerProvider } from '@/context/PlayerContext';
import MainLayout from '@/layouts/MainLayout';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import Script from 'next/script';
import { UserProvider } from '@/context/UserContext';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <Script id="pi-sdk" src="https://sdk.minepi.com/pi-sdk.js" strategy="lazyOnload" />
      <UserProvider>
        <PlayerProvider>
          <MainLayout>
            <Component {...pageProps} />
          </MainLayout>
        </PlayerProvider>
      </UserProvider>
    </I18nextProvider>
  );
}
