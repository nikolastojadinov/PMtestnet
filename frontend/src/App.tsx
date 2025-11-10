import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import { YouTubePlayerContainer } from "./components/YouTubePlayerContainer";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Player from "./components/Player";
import Home from "./pages/Home";
// Removed floating Pi test buttons; login now inside Profile dropdown.
// import PiLoginButton from './components/PiLoginButton';
// import PiPaymentButton from './components/PiPaymentButton';
import { useEffect, useState } from 'react';
import { initPiSDK, isPiBrowser } from './lib/pi';
import Search from "./pages/Search";
import Library from "./pages/Library";
import Playlist from "./pages/Playlist";
import CreatePlaylist from "./pages/CreatePlaylist";
import Favorites from "./pages/Favorites";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/privacy-policy";
import TermsOfService from "./pages/terms-of-service";
import DebugOverlay from "./components/DebugOverlay";

const queryClient = new QueryClient();

const App = () => {
  const [piReady, setPiReady] = useState(false);
  useEffect(() => {
    initPiSDK().then((ready) => { if (ready) { console.log('Pi SDK initialized'); setPiReady(true); } });
  }, []);
  // Mark app mounted and remove startup banner if present
  useEffect(() => {
    try {
      (window as any).__appMounted = true;
      const banner = document.getElementById('startup-banner');
      if (banner) banner.remove();
    } catch {}
  }, []);
  return (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <PlayerProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          { /* In Pi Browser, HashRouter is more robust against WebView/history quirks */ }
          {(() => {
            const UseRouter = (typeof window !== 'undefined' && isPiBrowser()) ? (HashRouter as any) : (BrowserRouter as any);
            return (
              <UseRouter>
                <div className="flex h-screen w-full bg-background text-foreground">
                  {/* Sidebar - hidden on mobile */}
                  <div className="hidden md:block">
                    <Sidebar />
                  </div>
                  
                  <div className="flex-1 flex flex-col w-full">
                    <Header />
                    <div className="flex-1 mt-16 mb-20 overflow-y-auto scrollbar-hide">
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/search" element={<Search />} />
                        <Route path="/library" element={<Library />} />
                        <Route path="/playlist/:id" element={<Playlist />} />
                        <Route path="/create-playlist" element={<CreatePlaylist />} />
                        <Route path="/favorites" element={<Favorites />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                        <Route path="/terms-of-service" element={<TermsOfService />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </div>
                  </div>
                  
                  {/* YouTube Player Container - globalni, pomera se između pozicija */}
                  <YouTubePlayerContainer />
                  
                  {/* Pi integration test buttons removed for production; use ProfileMenu for login */}
                  <Player />
                  <Footer />
                  <DebugOverlay />
                </div>
              </UseRouter>
            );
          })()}
          
        </TooltipProvider>
      </PlayerProvider>
    </LanguageProvider>
  </QueryClientProvider>
  );
};

export default App;
