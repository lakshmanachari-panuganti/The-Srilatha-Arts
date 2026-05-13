/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export - runs anywhere, no Node server required.
  // Works on the SWA Free tier (no SSR/ISR/Image-Optimization at runtime).
  // Trade-off: every page is pre-rendered at build time; any dynamic data
  // is fetched client-side from the Azure Functions backend.
  output: 'export',

  // SWA serves /shop and /shop/ identically when the file is /shop/index.html,
  // so trailingSlash keeps the export structure compatible with any host.
  trailingSlash: true,

  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // Required for `output: 'export'` - disables the on-the-fly optimizer.
    // next/image still works; it just serves the source URL untouched.
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.blob.core.windows.net',
      },
    ],
  },

  // NOTE: the `headers()` config does NOT run in `output: 'export'` mode.
  // Security headers are applied by `frontend/staticwebapp.config.json#globalHeaders`
  // when the export is hosted on Azure Static Web Apps.
}

export default nextConfig
