import { absoluteUrl, assetUrl } from '../lib/seo.mjs';

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
