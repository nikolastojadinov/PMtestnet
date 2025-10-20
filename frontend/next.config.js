/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	output: 'standalone',
		experimental: {
			serverActions: {},
		},
	eslint: {
		ignoreDuringBuilds: true,
	},
}

module.exports = nextConfig
