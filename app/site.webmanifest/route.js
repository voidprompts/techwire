import siteConfig from '../../site.config.mjs';

// Static export: emits /site.webmanifest at build time.
export const dynamic = 'force-static';

/**
 * Web app manifest. Served as a route rather than app/manifest.js so the file
 * lands at the conventional `/site.webmanifest` path referenced in <head>.
 */
export function GET() {
  const manifest = {
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: `${siteConfig.basePath}/`,
    scope: `${siteConfig.basePath}/`,
    display: 'standalone',
    background_color: '#0b1020',
    theme_color: '#0b1020',
    icons: [
      {
        src: `${siteConfig.basePath}/images/brand/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${siteConfig.basePath}/images/brand/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
}
