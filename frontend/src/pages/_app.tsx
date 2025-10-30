// ✅ Full rewrite — ensures PlayerProvider wraps the whole app
import type { AppProps } from "next/app";
import Head from "next/head";
import { PlayerProvider } from "@/context/PlayerContext";
import MainLayout from "@/layouts/MainLayout";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserProvider } from "@/context/UserContext";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Purple Music</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Purple Music – Listen, discover and enjoy global playlists" />
      </Head>

      {/* ✅ PlayerProvider wraps the whole app, fixes client-side crash */}
      <ThemeProvider>
        <UserProvider>
          <PlayerProvider>
            <MainLayout>
              <Component {...pageProps} />
            </MainLayout>
          </PlayerProvider>
        </UserProvider>
      </ThemeProvider>
    </>
  );
}
