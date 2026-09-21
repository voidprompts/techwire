/**
 * Shared constants safe to import from both the Next.js app and the scraper.
 * Kept free of node-only imports so it works in client components too.
 */

/** utm params Unsplash requires on links back to their site. */
export const UNSPLASH_UTM = `utm_source=${process.env.UNSPLASH_APP_NAME || 'techwire'}&utm_medium=referral`;

/** Canonical Unsplash link used in the attribution caption. */
export const UNSPLASH_ATTRIBUTION_URL = `https://unsplash.com/?${UNSPLASH_UTM}`;
