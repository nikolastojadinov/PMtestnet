import React, { useEffect, useRef, useState } from "react";
import Home from "../pages/Home";

declare global {
  interface Window {
    Pi?: any;
  }
}

// Lightweight helper to detect Pi Browser and load SDK if missing
function isPiBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /PiBrowser/i.test(ua) || (window as any).Pi != null;
}

function loadPiSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.Pi) return resolve(window.Pi);
    const script = document.createElement("script");
    script.src = "https://sdk.minepi.com/pi-sdk.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.Pi);
    script.onerror = () => reject(new Error("Pi SDK failed to load"));
    document.head.appendChild(script);
  });
}

type PiProfile = {
  uid?: string;
  username: string;
  accessToken?: string;
  wallet?: string;
  language?: string;
  country?: string | null;
};

function getBrowserLocale(): { language?: string; country?: string | null } {
  try {
    const lang = navigator.language || (navigator as any).userLanguage || undefined;
    let country: string | null = null;
    if (lang && /[-_]/.test(lang)) {
      country = lang.split(/[-_]/)[1]?.toUpperCase() || null;
    }
    return { language: lang, country };
  } catch {
    return { language: undefined, country: null };
  }
}

async function piAuthenticate(): Promise<PiProfile | null> {
  try {
    const Pi = await loadPiSdk();
    if (!Pi || typeof Pi.init !== "function") return null;
    // Use stable init signature compatible with older WebKit
    try {
      Pi.init({ version: "2.0", sandbox: false });
    } catch (_) {
      // Older SDKs may ignore options
      try { Pi.init(); } catch (_) { /* no-op */ }
    }
    const scopes = ["username", "payments", "wallet_address"];
    const authResult = await Pi.authenticate(scopes);
    const uid = authResult?.user?.uid;
    const username = authResult?.user?.username || "";
    const wallet = authResult?.user?.wallet?.address || authResult?.user?.wallet || undefined;
    const accessToken = authResult?.accessToken;
    const { language, country } = getBrowserLocale();
    return { uid, username, accessToken, wallet, language, country };
  } catch (e) {
    return null;
  }
}

async function storeUser(profile: PiProfile | null) {
  try {
    if (!profile) return;
    const base = (import.meta as any).env?.VITE_BACKEND_URL || "";
    const url = base ? `${base}/api/pi/auth` : "/api/pi/auth";
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
      // Avoid credentials by default; backend can accept anonymous
    }).catch(() => {});
  } catch (_) {
    // Ignore storage errors to not block UI
  }
}

const IntroAuthPage: React.FC = () => {
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [username, setUsername] = useState<string>("");
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [showApp, setShowApp] = useState<boolean>(false);
  const hideWelcomeTimer = useRef<number | null>(null);
  const authStartRef = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Only try Pi auth inside Pi Browser
      let profile: PiProfile | null = null;
      if (isPiBrowser()) {
        profile = await piAuthenticate();
        if (!cancelled && profile) {
          setUsername(profile.username || "");
          await storeUser(profile);
        }
      }

      // Enforce minimum 5s intro visibility from mount
      const elapsed = Date.now() - authStartRef.current;
      const minMs = 5000;
      const waitMs = elapsed < minMs ? (minMs - elapsed) : 0;
      await new Promise((r) => setTimeout(r, waitMs));

      if (!cancelled) {
        setAuthLoading(false);
        // Show welcome only if we have a username from auth
        if (profile && profile.username) {
          setShowWelcome(true);
          // Hide after 2s then show app
          hideWelcomeTimer.current = window.setTimeout(() => {
            setShowWelcome(false);
            setShowApp(true);
          }, 2000) as unknown as number;
        } else {
          // No user data → go straight to app
          setShowApp(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (hideWelcomeTimer.current) {
        window.clearTimeout(hideWelcomeTimer.current);
      }
    };
  }, []);

  // Fullscreen video while authenticating
  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <video
          src="/intro.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {showWelcome && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 transition-opacity duration-500">
          <div className="px-6 py-4 rounded-xl bg-white text-black text-xl font-semibold shadow-lg">
            {"Welcome "}{username}
          </div>
        </div>
      )}
      {/* Main app after welcome */}
      {showApp && <Home />}
      {!showApp && !showWelcome && (
        // Safety: small fallback delay if welcome skipped
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 text-white">Loading…</div>
      )}
    </div>
  );
};

export default IntroAuthPage;
