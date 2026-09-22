/**
 * Canonical URL + structured-data helpers.
 *
 * Two rules everything here enforces, because getting them wrong is what
 * produced the SEO defects this module was written to fix:
 *
 *  1. `trailingSlash: true` in next.config.mjs means the ONLY non-redirecting
 *     form of a page URL is `…/foo/`. Canonicals, sitemap entries, RSS links
 *     and JSON-LD `@id`s must all use that exact form or they disagree with
 *     each other and every sitemap URL 301s.
 *  2. Structured data and social cards need ABSOLUTE urls. A relative
 *     `/images/thumbnails/x.jpg` fails rich-result parsing silently.
 *
 * Note on basePath: `siteConfig.url` is expected to already include the deploy
 * basePath when there is one (the GitHub Pages workflow sets
 * NEXT_PUBLIC_SITE_URL to origin + base_path), so paths are simply appended.
 */
import siteConfig from '../site.config.mjs';

/** Paths that are real files, not pages — they must NOT get a trailing slash. */
const FILE_LIKE = /\.[a-z0-9]{2,5}$/i;

/**
 * Normalise an internal path to its canonical, non-redirecting form.
 * `/posts/foo` -> `/posts/foo/` ; `/rss.xml` -> `/rss.xml` ; `/` -> `/`
 */
export function canonicalPath(path = '/') {
  if (!path.startsWith('/')) return path;
  const [pathname, rest = ''] = path.split(/(?=[?#])/);
  const suffix = rest || '';
  if (pathname === '/') return `/${suffix}`;
  if (FILE_LIKE.test(pathname)) return `${pathname}${suffix}`;
  return `${pathname.replace(/\/+$/, '')}/${suffix}`;
}

/** Absolute, canonical URL for an internal path (or a pass-through for http(s) urls). */
export function absoluteUrl(path = '/') {
  if (!path) return siteConfig.url;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('//')) return `https:${path}`;
  return `${siteConfig.url}${canonicalPath(path)}`;
}

/** Absolute URL for a static asset in /public (never trailing-slashed). */
export function assetUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteConfig.url}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The site-wide fallback share card, as an absolute URL. */
export const defaultOgImageUrl = assetUrl(siteConfig.ogImage.url);

/** Open Graph `images` array for a page, falling back to the site card. */
export function ogImages(image, alt) {
  if (image) {
    return [{ url: assetUrl(image), width: 1200, height: 630, alt: alt || siteConfig.name }];
  }
  return [
    {
      url: defaultOgImageUrl,
      width: siteConfig.ogImage.width,
      height: siteConfig.ogImage.height,
      alt: siteConfig.ogImage.alt,
      type: 'image/jpeg',
    },
  ];
}

/** Twitter `images` array for a page (absolute urls only). */
export function twitterImages(image) {
  return [image ? assetUrl(image) : defaultOgImageUrl];
}

/**
 * Organization node reused by every schema graph.
 * `logo` is required for article rich-result eligibility.
 */
export function publisherSchema() {
  return {
    '@type': 'Organization',
    '@id': `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: `${siteConfig.url}/`,
    logo: {
      '@type': 'ImageObject',
      url: assetUrl(siteConfig.logo.url),
      width: siteConfig.logo.width,
      height: siteConfig.logo.height,
      caption: siteConfig.name,
    },
    image: defaultOgImageUrl,
  };
}

/**
 * Thin-content gate for keyword-generated topic pages.
 *
 * Topic pages are minted from free-form article keywords, so the pipeline
 * creates a brand new one for every new keyword it invents — 16 topic pages for
 * 4 posts today, hundreds within weeks at ~4 posts per run. A topic holding one
 * post is a doorway page with no unique value, the exact pattern search-quality
 * reviews flag.
 *
 * A topic becomes indexable only once it holds `topicIndexThreshold` posts.
 * Below that it is `noindex, follow`: still crawlable, link equity still flows
 * through to the articles, but it never competes as a standalone result.
 */
export function isTopicIndexable(topic) {
  const count = typeof topic === 'number' ? topic : topic?.count ?? 0;
  return count >= siteConfig.topicIndexThreshold;
}

/** Search Console / Bing / Yandex verification tokens, when configured. */
export function verificationMeta() {
  const { google, bing, yandex } = siteConfig.verification;
  const verification = {};
  if (google) verification.google = google;
  if (bing) verification.other = { 'msvalidate.01': bing };
  if (yandex) verification.yandex = yandex;
  return Object.keys(verification).length > 0 ? verification : undefined;
}

export default { absoluteUrl, assetUrl, canonicalPath, ogImages, twitterImages, publisherSchema };
