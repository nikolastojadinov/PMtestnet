/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable Next Image optimization for Netlify if desired
  images: {
    unoptimized: true,
  },
  // Stable build id
  generateBuildId: async () => {
    return 'purple-music-build'
  },
  // Global no-store headers to avoid caching issues on SSR
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
