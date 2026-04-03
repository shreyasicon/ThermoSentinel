/** @type {import('next').NextConfig} */
const staticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  ...(staticExport ? { output: 'export' } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
