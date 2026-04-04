/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow large media uploads (100 GB total batch)
    serverActions: {
      bodySizeLimit: "100gb"
    }
  }
};

export default nextConfig;
