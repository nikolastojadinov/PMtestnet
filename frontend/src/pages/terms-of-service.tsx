import React from "react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-black text-[#dddddd] px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center text-[#f0b90b]">Terms of Service — Purple Music</h1>
      <div className="space-y-6 leading-relaxed">
        <p className="text-sm opacity-80 text-center">Last updated: November 2025</p>

        <p>
          Welcome to <strong>Purple Music</strong>, a digital music discovery and streaming application integrated
          with <strong>Pi Network</strong> authentication and payments.
        </p>
        <p>
          By accessing or using Purple Music, you agree to comply with and be bound by these Terms of Service. If you
          do not agree with these terms, please do not use our application.
        </p>

        <hr className="border-white/10" />

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">1. Overview</h2>
          <p>
            Purple Music is a web-based platform that allows users to discover, play, and manage music playlists
            sourced from public YouTube content. All video playback is handled through the official
            {" "}
            <strong>YouTube IFrame Player API</strong>, and all metadata are retrieved via
            {" "}
            <strong>YouTube Data API v3</strong> in compliance with Google’s terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">2. User Accounts</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Login and authentication are managed exclusively through <strong>Pi Network SDK</strong>.</li>
            <li>We do not require email, password, or third-party sign-up forms.</li>
            <li>Each user is identified by their unique Pi username and wallet address.</li>
            <li>You are responsible for any actions performed under your account through the Pi Network system.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">3. Premium Membership</h2>
          <p>Purple Music offers <strong>optional Premium features</strong> available through <strong>Pi Payments API</strong>:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Weekly Plan: 1π</li>
            <li>Monthly Plan: 3.14π</li>
            <li>Yearly Plan: 31.4π</li>
          </ul>
          <p className="mt-3">
            Premium access removes ads and unlocks extra features. Payment transactions are processed within Pi Network,
            and Purple Music does not access or store wallet keys, transaction hashes, or sensitive payment data. Your
            “Premium Member” status will appear under your profile until the expiration date.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">4. YouTube API Compliance</h2>
          <p>
            Purple Music complies fully with YouTube’s
            {" "}
            <a
              className="underline decoration-[#f0b90b]/60 underline-offset-4 hover:text-[#f0b90b]"
              href="https://developers.google.com/youtube/terms/api-services-terms-of-service"
              target="_blank"
              rel="noreferrer"
            >
              API Terms of Service
            </a>
            {" "}
            and
            {" "}
            <a
              className="underline decoration-[#f0b90b]/60 underline-offset-4 hover:text-[#f0b90b]"
              href="https://www.youtube.com/howyoutubeworks/policies/community-guidelines/"
              target="_blank"
              rel="noreferrer"
            >
              YouTube Community Guidelines
            </a>
            .
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Uses only allowed public API methods: <code>search.list</code>, <code>playlists.list</code>, <code>playlistItems.list</code>, <code>videos.list</code>, <code>i18nRegions</code>, and <code>i18nLanguages</code>.</li>
            <li>The YouTube player is always visible, unmodified, and includes official controls and branding.</li>
            <li>The app does not store or redistribute copyrighted video or audio content.</li>
            <li>Cached metadata are limited to titles, thumbnails, and playlist info, in compliance with YouTube’s data retention policy.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">5. Supabase and Data Storage</h2>
          <p>
            All application data (such as playlists, likes, and user settings) are securely stored in
            {" "}
            <strong>Supabase</strong>, our database and backend platform. Supabase provides built-in encryption and
            access control through Row-Level Security (RLS). We collect only minimal information necessary to operate the app:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Pi username</li>
            <li>Wallet address</li>
            <li>Language preference</li>
            <li>Premium subscription status</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">6. Acceptable Use Policy</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Misuse the YouTube API, Pi SDK, or Pi Payments system</li>
            <li>Attempt to reverse-engineer, scrape, or clone Purple Music content</li>
            <li>Upload or distribute copyrighted material without authorization</li>
            <li>Circumvent regional or usage restrictions</li>
            <li>Engage in any activity that could harm Purple Music, Pi Network, or YouTube services</li>
          </ul>
          <p className="mt-3">Violation of these terms may result in immediate suspension or permanent account termination.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">7. Disclaimer of Warranties</h2>
          <p>
            Purple Music is provided <strong>“as is”</strong> without any warranties or guarantees. We make no
            representations about uptime, data accuracy, or feature availability. We are not responsible for issues
            arising from third-party platforms such as YouTube or Pi Network.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">8. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Purple Music, its developers, and affiliates shall not be liable for any indirect, incidental, or consequential damages, including but not limited to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Loss of data or access</li>
            <li>Interrupted service or playback</li>
            <li>Unauthorized access or API errors</li>
          </ul>
          <p className="mt-3">Your use of the service is at your own risk.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">9. Termination</h2>
          <p>
            We reserve the right to suspend or terminate user access at any time for violations of these Terms or other
            harmful activities. Upon termination, any stored data may be deleted without notice.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">10. Modifications to the Terms</h2>
          <p>
            Purple Music reserves the right to modify these Terms of Service at any time. All updates will be posted on
            this page and become effective immediately upon publication.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-[#f0b90b]">11. Contact</h2>
          <p>
            If you have questions about these Terms, please contact us at:
            {" "}
            <a href="mailto:support@purplemusic.app" className="underline decoration-[#f0b90b]/60 underline-offset-4 hover:text-[#f0b90b]">
              support@purplemusic.app
            </a>
          </p>
        </section>

        <p className="text-center opacity-80">© 2025 Purple Music. All rights reserved.</p>
      </div>
    </div>
  );
}
