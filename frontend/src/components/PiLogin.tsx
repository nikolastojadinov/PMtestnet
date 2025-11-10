import { useEffect, useState } from 'react';
import WelcomePopup from './WelcomePopup';
import GoPremiumModal from './GoPremiumModal';
import { useLanguage } from '../contexts/LanguageContext';
import { upsertUser, logStatistic, detectDevice, detectCountry } from '../lib/supabaseClient';

declare global {
  interface Window {
    Pi?: any;
  }
}

function loadPiSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Pi) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://sdk.minepi.com/pi-sdk.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Pi SDK'));
    document.head.appendChild(script);
  });
}

export default function PiLogin() {
  const { currentLanguage, t } = useLanguage();
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      // Only attempt in Pi Browser environment
      try {
        await loadPiSdk();
      } catch {
        return; // sdk load failed or not Pi Browser
      }
      if (!window.Pi) return;
      try {
        window.Pi.init({ version: '2.0' });
      } catch (e) {
        console.warn('[Pi] init failed', (e as any)?.message || e);
        return;
      }
      const onIncomplete = (incomplete: any) => {
        console.warn('[Pi] authenticate incomplete', incomplete);
      };
      const onAuthSuccess = async (result: any) => {
        if (cancelled) return;
        try {
          const piUser = result?.user || {};
          const country = detectCountry();
          const userRecord = {
            pi_uid: piUser.uid,
            username: piUser.username || null,
            wallet: piUser.wallet_address || null,
            language: currentLanguage,
            user_consent: true,
            country,
          };
          const { error } = await upsertUser(userRecord as any);
          if (error) {
            console.warn('[Pi] upsert user failed', error.message || error);
          } else {
            setUsername(userRecord.username);
            setWelcomeVisible(true);
            logStatistic('login', detectDevice(), { pi_uid: userRecord.pi_uid });
            setTimeout(() => setPremiumOpen(true), 1600); // open premium after popup fades
          }
        } catch (e) {
          console.warn('[Pi] auth success handler error', (e as any)?.message || e);
        }
      };
      try {
        window.Pi.authenticate(['username', 'wallet_address'], onIncomplete, onAuthSuccess);
        setInitialized(true);
      } catch (e) {
        console.warn('[Pi] authenticate call failed', (e as any)?.message || e);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [currentLanguage]);

  return (
    <>
      <WelcomePopup
        username={username}
        visible={welcomeVisible}
        onClose={() => setWelcomeVisible(false)}
        message={username ? `${t('welcome_back')}, ${username}` : t('welcome_back')}
      />
      <GoPremiumModal open={premiumOpen} onOpenChange={setPremiumOpen} />
      {/* Hidden status element for debugging */}
      <div style={{ display: 'none' }} data-pi-init={initialized ? 'yes' : 'no'} />
    </>
  );
}
