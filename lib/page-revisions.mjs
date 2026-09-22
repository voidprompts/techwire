/**
 * Declared revision dates for the hand-written, evergreen pages.
 *
 * Why this file exists
 * --------------------
 * The sitemap used to stamp `new Date()` on these routes. The pipeline deploys
 * roughly five times a day, so /about, /contact and the legal pages advertised a
 * brand-new `lastmod` several times daily while their content never changed.
 * Google treats a lastmod that is provably wrong as untrustworthy and then
 * discounts it for the *whole* sitemap — including the article URLs where it is
 * genuinely useful.
 *
 * File mtime is not a fix either: a CI checkout rewrites every mtime to the
 * moment of the build, and a shallow clone makes `git log` report the deploy
 * commit for every file. The only signal that survives a fresh clone is one
 * committed alongside the content.
 *
 * So: when you meaningfully edit one of these pages, bump its date here in the
 * same commit. Articles are unaffected — they derive lastmod from their own
 * front-matter `date`.
 */
export const PAGE_REVISIONS = {
  '/about': '2025-09-19',
  '/contact': '2025-09-19',
  '/privacy-policy': '2025-09-19',
  '/terms-of-service': '2025-09-19',
};

/** Revision date for a static route, as a Date. Falls back to the oldest known. */
export function pageRevision(path, fallback) {
  const key = `/${String(path).replace(/^\/+|\/+$/g, '')}`;
  const declared = PAGE_REVISIONS[key];
  if (!declared) return fallback ?? new Date(0);
  const date = new Date(`${declared}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? fallback ?? new Date(0) : date;
}

export default PAGE_REVISIONS;
