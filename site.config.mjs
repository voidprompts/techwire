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
  email: 'editorial@techwire.example',
  // Google AdSense publisher id, e.g. "ca-pub-1234567890123456".
  // Leave empty until AdSense approves the site — the placeholders stay inert but present.
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '',
  adSlots: {
    belowTitle: process.env.NEXT_PUBLIC_ADSLOT_BELOW_TITLE || '',
    inArticle: process.env.NEXT_PUBLIC_ADSLOT_IN_ARTICLE || '',
    sidebar: process.env.NEXT_PUBLIC_ADSLOT_SIDEBAR || '',
    footer: process.env.NEXT_PUBLIC_ADSLOT_FOOTER || '',
  },
  postsPerPage: 12,
  nav: [
    { href: '/', label: 'Home' },
    { href: '/archive', label: 'Archive' },
    { href: '/topics', label: 'Topics' },
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
