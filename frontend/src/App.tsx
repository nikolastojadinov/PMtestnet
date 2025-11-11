import React, { useEffect, useMemo, useState } from 'react';
import { PiSDKProvider, usePiSDK } from './components/PiSDKProvider';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import MainLayout from './MainLayout';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <PiSDKProvider>
          <AppShell />
        </PiSDKProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

// Lightweight background init + welcome popup
const AppShell: React.FC = () => {
  const { user, loading } = usePiSDK();
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string>('');
  const [visible, setVisible] = useState(false); // for fade animation

  useEffect(() => {
    if (!loading && user?.username) {
      setWelcomeName(user.username);
      setShowWelcome(true);
      // small delay to trigger CSS transition
      const appear = setTimeout(() => setVisible(true), 10);
      const hide = setTimeout(() => {
        setVisible(false);
        const unmount = setTimeout(() => setShowWelcome(false), 300);
        return () => clearTimeout(unmount);
      }, 3000);
      return () => {
        clearTimeout(appear);
        clearTimeout(hide);
      };
    }
  }, [loading, user?.username]);

  return (
    <>
      {loading ? (
        <div className="fixed inset-0 z-[60] bg-background/90 flex items-center justify-center">
          {/* Minimal splash while SDK initializes (no intro video) */}
          <div className="text-sm text-foreground/60">Loading…</div>
        </div>
      ) : null}

      <MainLayout />

      {showWelcome && (
        <div className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center">
          <div
            className={
              'pointer-events-auto select-none px-6 py-4 rounded-xl shadow-xl ' +
              'bg-purple-900/80 text-white backdrop-blur-sm ' +
              'transition-opacity duration-300 ' +
              (visible ? 'opacity-100' : 'opacity-0')
            }
          >
            <span className="font-medium">Welcome, {welcomeName}</span>
          </div>
        </div>
      )}
    </>
  );
};
