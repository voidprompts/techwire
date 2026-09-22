import { absoluteUrl, assetUrl } from '../lib/seo.mjs';

// Next.js 16 requires metadata routes to opt into static generation explicitly
// when using `output: 'export'`.
export const dynamic = 'force-static';

export default function robots() {
  return {
    rules: [
      // Single merged rule block — duplicate User-Agent sections confuse some crawlers.
      { userAgent: '*', allow: '/', disallow: ['/_next/'] },
    ],
    sitemap: assetUrl('/sitemap.xml'),
    host: absoluteUrl('/').replace(/\/$/, ''),
  };
}
