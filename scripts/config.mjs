/**
 * Scraper configuration.
 * Everything here is tunable without touching pipeline code.
 */

export const SOURCES = [
  {
    name: 'TechCrunch',
    type: 'rss',
    url: 'https://techcrunch.com/feed/',
    weight: 1,
  },
  {
    name: 'The Verge',
    type: 'rss',
    url: 'https://www.theverge.com/rss/index.xml',
    weight: 1,
  },
  {
    name: 'Ars Technica',
    type: 'rss',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    weight: 1,
  },
  {
    name: 'Engadget',
    type: 'rss',
    url: 'https://www.engadget.com/rss.xml',
    weight: 1,
  },
  {
    name: 'Wired',
    type: 'rss',
    url: 'https://www.wired.com/feed/rss',
    weight: 1,
  },
  {
    name: 'Hacker News',
    type: 'hackernews',
    // Algolia public API — no key required. Front-page stories above a score threshold.
    url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40',
    minScore: 120,
    weight: 1,
  },
  {
    name: 'Reddit r/technology',
    type: 'reddit',
    url: 'https://www.reddit.com/r/technology/top.json?t=day&limit=40',
    minScore: 800,
    weight: 1,
  },
  {
    name: 'Reddit r/programming',
    type: 'reddit',
    url: 'https://www.reddit.com/r/programming/top.json?t=day&limit=25',
    minScore: 400,
    weight: 1,
  },
];

export const PIPELINE = {
  /** Max articles published per run. Keeps commits small and API usage inside free tiers. */
  maxPostsPerRun: Number(process.env.MAX_POSTS_PER_RUN || 4),
  /** Candidates older than this are ignored. */
  maxAgeHours: Number(process.env.MAX_AGE_HOURS || 48),
  /** Minimum extracted source characters required before we ask the AI to analyse. */
  minSourceChars: 600,
  /** Similarity ratio (0-1) above which a candidate counts as a duplicate of an existing post. */
  duplicateThreshold: 0.72,
  /** Polite delay between outbound fetches, in ms. */
  requestDelayMs: 900,
  /** Per-request network timeout, in ms. */
  requestTimeoutMs: 20000,
  /** Retry attempts for transient network/API failures. */
  maxRetries: 3,
  userAgent:
    'TechWireBot/1.0 (+https://techwire.pages.dev; static news curation index; contact editorial@techwire.example)',
  targetWordsMin: 800,
  targetWordsMax: 1200,
};

export const PATHS = {
  postsDir: 'content/posts',
  stateFile: 'content/.scraper-state.json',
};

/**
 * Domains we never scrape body text from (hard paywalls or robots restrictions).
 * Candidates pointing here are dropped rather than half-scraped.
 */
export const BLOCKED_DOMAINS = [
  'wsj.com',
  'ft.com',
  'bloomberg.com',
  'nytimes.com',
  'economist.com',
  'theinformation.com',
  'seekingalpha.com',
  'medium.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'imgur.com',
  'github.com',
];

/** Low-signal headlines we skip outright. */
export const TITLE_BLOCKLIST = [
  /^ask hn/i,
  /^show hn/i,
  /^tell hn/i,
  /who is hiring/i,
  /\bdeal(s)?\b.*\b(off|discount|save)\b/i,
  /best .* deals/i,
  /coupon/i,
  /giveaway/i,
  /horoscope/i,
];
