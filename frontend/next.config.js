/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  trailingSlash: true,
  experimental: {
    typedRoutes: true
  },
  images: {
    domains: [
      'i.ytimg.com',                     // YouTube thumbnails
      'ofkfygqrfenctzitigae.supabase.co', // Supabase Storage
      'yt3.ggpht.com'
    ],
    formats: ['image/avif', 'image/webp']
  }
};

module.exports = nextConfig;
