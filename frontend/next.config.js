/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverActions: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 👇 Obavezno: sprečava prerender (static export)
  // i forsira dinamičko renderovanje svake stranice
  images: {
    unoptimized: true,
  },
  // 👇 SSR fallback – omogućava dinamički response na Netlify-u
  generateBuildId: async () => {
    return 'purple-music-build'
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
