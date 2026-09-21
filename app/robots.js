import siteConfig from '../site.config.mjs';

export default function robots() {
  return {
    rules: [
      // Single merged rule block — duplicate User-Agent sections confuse some crawlers.
      { userAgent: '*', allow: '/', disallow: ['/_next/'] },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
