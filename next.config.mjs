/** @type {import('next').NextConfig} */
const staticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  // Trailing slashes improve static hosting (Amplify/S3) so /analytics/ maps to analytics/index.html.
  ...(staticExport ? { output: 'export', trailingSlash: true } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
