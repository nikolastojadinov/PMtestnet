/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  images: {
    domains: [
      'i.ytimg.com',                     // YouTube thumbnails
      'ofkfygqrfenctzitigae.supabase.co' // Supabase Storage
    ],
    formats: ['image/avif', 'image/webp']
  }
};

module.exports = nextConfig;
