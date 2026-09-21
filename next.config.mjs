/** @type {import('next').NextConfig} */

// GitHub Pages serves project sites from https://<user>.github.io/<repo>.
// Set NEXT_PUBLIC_BASE_PATH="/techwire" in that case. Cloudflare Pages needs no basePath.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  // Strict static build: emits pure HTML/CSS/JS into ./out
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  // Static hosts have no Next.js image optimizer, so images must be unoptimized.
  // next/image still emits width/height + lazy loading, which keeps CLS at 0.
  images: {
    unoptimized: true,
  },
  // Emit /about/index.html instead of /about.html so any static host resolves it.
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
};

export default nextConfig;
