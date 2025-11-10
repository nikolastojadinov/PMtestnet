import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-[#dddddd] px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center text-[#f0b90b]">Privacy Policy — Purple Music</h1>
      <div className="space-y-6 leading-relaxed">
        <p className="text-sm opacity-80 text-center">Last updated: November 2025</p>

        <p>
          Welcome to <strong>Purple Music</strong>, a web-based music streaming platform integrated with
          <strong> Pi Network</strong> authentication and payments. Your privacy and data protection are
          extremely important to us. This Privacy Policy explains how we collect, use, and protect your data
          when using our application.
        </p>

        <hr className="border-white/10" />

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">1. Data Collection and Usage</h2>
          <p>We collect only the minimum necessary information to provide our services:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              <strong>Pi Network User Data</strong>: Your username, Pi wallet address, and consent status are
              securely provided through the Pi SDK during login.
            </li>
            <li>
              <strong>App Usage Data</strong>: We record limited anonymous statistics such as played tracks,
              likes, and playlist activity to improve the app experience.
            </li>
            <li>
              <strong>Payment Data</strong>: Payments are handled entirely within the <strong>Pi Network</strong>
              {" "}ecosystem using <strong>Pi Payments API</strong>. We never access or store your private keys,
              wallet credentials, or any sensitive financial data.
            </li>
          </ul>
          <p className="mt-3">We do not sell, rent, or trade user data to third parties.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">2. YouTube API Integration</h2>
          <p>
            Purple Music uses the official <strong>YouTube Data API v3</strong> in full compliance with Google’s
            {" "}
            <a
              className="underline decoration-[#f0b90b]/60 underline-offset-4 hover:text-[#f0b90b]"
              href="https://developers.google.com/youtube/terms/api-services-terms-of-service"
              target="_blank"
              rel="noreferrer"
            >
              YouTube API Terms of Service
            </a>
            . By using this app, you also agree to be bound by Google’s Privacy Policy:
            {" "}
            <a
              className="underline decoration-[#f0b90b]/60 underline-offset-4 hover:text-[#f0b90b]"
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              https://policies.google.com/privacy
            </a>
            .
          </p>
          <h3 className="text-xl font-semibold mt-4 mb-2">YouTube Integration Details:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              The app displays and streams public music playlists and videos from YouTube through the official
              <strong> YouTube IFrame Player API</strong>.
            </li>
            <li>
              The player is always visible (minimum size 200x200px) and includes full YouTube branding and controls.
            </li>
            <li>The app never modifies, hides, or overlays the official YouTube player UI.</li>
            <li>
              Metadata (title, artist, playlist name, thumbnails) may be cached in <strong>Supabase</strong> for
              performance, but no copyrighted media is stored or redistributed.
            </li>
            <li>
              API calls use only the following endpoints: <code>playlists.list</code>, <code>playlistItems.list</code>,
              {" "}
              <code>videos.list</code>, <code>search.list</code>, <code>i18nRegions</code>, and <code>i18nLanguages</code>.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">3. Pi Network Authentication</h2>
          <p>
            We use the <strong>Pi Network SDK</strong> for secure, decentralized login. Upon login, your
            <strong> Pi username</strong>, <strong>wallet address</strong>, and <strong>authentication token</strong>
            {" "}are transmitted securely to our Supabase backend via HTTPS. These data are used only for:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Identifying your user account</li>
            <li>Managing your premium subscription status</li>
            <li>Tracking app usage statistics (anonymized)</li>
          </ul>
          <p className="mt-3">Your Pi data are never shared outside the Purple Music platform.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">4. Pi Payments</h2>
          <p>Purple Music offers optional <strong>Premium Plans</strong> processed via <strong>Pi Payments API</strong>:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Weekly Plan: 1π</li>
            <li>Monthly Plan: 3.14π</li>
            <li>Yearly Plan: 31.4π</li>
          </ul>
          <p className="mt-3">
            All payments are handled by Pi Network. Purple Music does not store wallet or transaction data. Premium
            access automatically expires after the selected duration.
          </p>
          <p className="mt-2">
            If you are a Premium Member, your account section will display:
            <br />
            <em className="opacity-90">“Premium Member — valid until [date]”</em>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">5. Data Retention and Deletion</h2>
          <p>
            We store user-related data (username, wallet, consent status) only for as long as the user remains active.
            You may request deletion of your data at any time by contacting us at
            {" "}
            <a href="mailto:support@purplemusic.app" className="underline decoration-[#f0b90b]/60 underline-offset-4 hover:text-[#f0b90b]">
              support@purplemusic.app
            </a>
            . All Supabase data are periodically purged for inactive test accounts and sandbox users.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">6. Cookies and Local Storage</h2>
          <p>
            The app uses minimal local storage for language preference and playback session continuity. No third-party
            cookies are used for tracking or advertising.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">7. Security</h2>
          <p>
            All communication between client and backend is encrypted via HTTPS/TLS. Supabase handles database-level
            security, authentication, and access control through RLS (Row-Level Security).
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy as our services evolve. The latest version will always be available on
            this page.
          </p>
        </section>

        <p className="text-center opacity-80">© 2025 Purple Music. All rights reserved.</p>
      </div>
    </div>
  );
}
