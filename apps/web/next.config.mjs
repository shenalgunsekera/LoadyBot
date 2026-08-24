/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@loady/core'],
  serverExternalPackages: ['postgres'],
};

export default nextConfig;
