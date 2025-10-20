/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	output: 'export',
	eslint: {
		ignoreDuringBuilds: true
	}
}
module.exports = nextConfig
