/**
 * Single source of truth for site-wide settings.
 * Everything here is safe to commit — no secrets.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const siteConfig = {
  name: 'TechWire',
  tagline: 'The analytical index of technology news',
  // Kept under 160 characters so search engines render it without truncation.
  description:
    'Independent analysis of the technology industry — original briefings on AI, hardware, software and the business behind the headlines.',
  // Longer version for on-page copy where truncation is not a concern.
  descriptionLong:
    'TechWire is an independent technology curation index. We track the industry’s primary sources and publish original, analytical briefings on AI, hardware, software and the business of technology.',
  // Change this to your real deployed origin before going live.
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://techwire.pages.dev').replace(/\/$/, ''),
  basePath,
  locale: 'en_US',
  // Single source of truth for the public contact address. Rendered on
  // /about, /contact, /privacy-policy and /terms-of-service, and used as the
  // contact in the scraper's User-Agent (see scripts/config.mjs).
  email: 'editorial.techwire@gmail.com',
  // Google AdSense publisher id, e.g. "ca-pub-1234567890123456".
  // Leave empty until AdSense approves the site — the placeholders stay inert but present.
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '',
  // Default social share card, used by every page that has no image of its own.
  // Must be referenced as an ABSOLUTE url in meta tags — see lib/seo.mjs.
  ogImage: {
    url: '/images/brand/og-default.jpg',
    width: 1200,
    height: 630,
    alt: 'TechWire — the analytical index of technology news',
  },
  // Publisher logo for schema.org Organization. Google requires a raster image
  // for article rich-result eligibility (SVG is not accepted there).
  logo: {
    url: '/images/brand/logo.png',
    width: 600,
    height: 160,
  },
  // Search engine ownership verification. Paste the token only (not the whole
  // meta tag) into these env vars, or hardcode it here.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
    bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || '',
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || '',
  },
  // Topic pages below this post count are noindex'd: a one-post tag page is
  // thin content, and at ~4 posts/run the pipeline would otherwise manufacture
  // hundreds of them. They stay crawlable/followable so link equity still flows.
  topicIndexThreshold: Number(process.env.NEXT_PUBLIC_TOPIC_INDEX_THRESHOLD || 3),
  // Category hubs follow the same quality floor. New sections remain useful
  // navigation (`noindex, follow`) without entering search or the sitemap until
  // they contain enough distinct editorial coverage.
  categoryIndexThreshold: Number(process.env.NEXT_PUBLIC_CATEGORY_INDEX_THRESHOLD || 3),
  adSlots: {
    belowTitle: process.env.NEXT_PUBLIC_ADSLOT_BELOW_TITLE || '',
    inArticle: process.env.NEXT_PUBLIC_ADSLOT_IN_ARTICLE || '',
    sidebar: process.env.NEXT_PUBLIC_ADSLOT_SIDEBAR || '',
    footer: process.env.NEXT_PUBLIC_ADSLOT_FOOTER || '',
  },
  postsPerPage: 12,
  // Primary navigation is generated from the silo taxonomy in lib/silos.mjs.
  // These are the secondary/utility destinations.
  nav: [
    { href: '/archive', label: 'Archive' },
    { href: '/about', label: 'About' },
  ],
  footerNav: [
    { href: '/about', label: 'About' },
    { href: '/privacy-policy', label: 'Privacy Policy' },
    { href: '/terms-of-service', label: 'Terms of Service' },
    { href: '/contact', label: 'Contact' },
  ],
};

/** Prefix an internal absolute path with the deploy basePath (for non-Link usage). */
export function withBasePath(path) {
  if (!path.startsWith('/')) return path;
  return `${basePath}${path}`;
}

export default siteConfig;
