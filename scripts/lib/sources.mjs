import { XMLParser } from 'fast-xml-parser';
import { PIPELINE, TITLE_BLOCKLIST } from '../config.mjs';
import {
  decodeEntities,
  fetchWithTimeout,
  hostnameOf,
  hoursSince,
  log,
  normalizeUrl,
  stripHtml,
  withRetry,
} from './utils.mjs';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  processEntities: true,
});

function baseHeaders() {
  return { 'user-agent': PIPELINE.userAgent, accept: '*/*' };
}

async function fetchText(url, accept) {
  return withRetry(
    async () => {
      const response = await fetchWithTimeout(url, {
        timeoutMs: PIPELINE.requestTimeoutMs,
        headers: { ...baseHeaders(), ...(accept ? { accept } : {}) },
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} for ${url}`);
        // 4xx (other than 429) will not fix themselves — do not burn retries.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) error.fatal = true;
        throw error;
      }
      return response.text();
    },
    { retries: PIPELINE.maxRetries, label: `fetch ${hostnameOf(url) || url}` }
  );
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function pickText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object') return node['#text'] || node['@_href'] || '';
  return String(node);
}

/** Best-effort lead image from the many competing RSS image conventions. */
function extractFeedImage(entry) {
  const candidates = [
    entry['media:content'],
    entry['media:thumbnail'],
    entry.enclosure,
    entry['itunes:image'],
  ];
  for (const candidate of candidates) {
    for (const item of asArray(candidate)) {
      const url = item?.['@_url'] || item?.['@_href'];
      const type = item?.['@_type'] || '';
      if (url && (!type || type.startsWith('image'))) return url;
    }
  }
  const html = [
    pickText(entry['content:encoded']),
    pickText(entry.content),
    pickText(entry.description),
    pickText(entry.summary),
  ].join(' ');
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? decodeEntities(match[1]) : '';
}

function isBlockedTitle(title) {
  return TITLE_BLOCKLIST.some((pattern) => pattern.test(title));
}

function buildCandidate({ title, url, sourceName, publishedAt, summary, image, score = 0 }) {
  const cleanTitle = decodeEntities(stripHtml(title || '')).trim();
  const cleanUrl = normalizeUrl(url || '');
  if (!cleanTitle || !cleanUrl || !/^https?:/i.test(cleanUrl)) return null;
  if (isBlockedTitle(cleanTitle)) return null;
  return {
    title: cleanTitle,
    url: cleanUrl,
    domain: hostnameOf(cleanUrl),
    sourceName,
    publishedAt: publishedAt || new Date().toISOString(),
    summary: stripHtml(summary || '').slice(0, 1200),
    image: image || '',
    score,
  };
}

/** RSS 2.0 and Atom, both handled by the same normalizer. */
async function collectRss(source) {
  const xml = await fetchText(source.url, 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8');
  const parsed = parser.parse(xml);
  const entries = [
    ...asArray(parsed?.rss?.channel?.item),
    ...asArray(parsed?.feed?.entry),
    ...asArray(parsed?.['rdf:RDF']?.item),
  ];

  return entries
    .map((entry) => {
      const link =
        pickText(entry.link) ||
        asArray(entry.link).map((l) => l?.['@_href']).find(Boolean) ||
        pickText(entry.guid) ||
        '';
      return buildCandidate({
        title: pickText(entry.title),
        url: link,
        sourceName: source.name,
        publishedAt: pickText(entry.pubDate) || pickText(entry.published) || pickText(entry.updated) || pickText(entry['dc:date']),
        summary: pickText(entry.description) || pickText(entry.summary) || pickText(entry['content:encoded']),
        image: extractFeedImage(entry),
      });
    })
    .filter(Boolean);
}

/** Hacker News front page via the public Algolia API (no key needed). */
async function collectHackerNews(source) {
  const json = JSON.parse(await fetchText(source.url, 'application/json'));
  return (json.hits || [])
    .filter((hit) => hit.url && (hit.points || 0) >= (source.minScore || 0))
    .map((hit) =>
      buildCandidate({
        title: hit.title,
        url: hit.url,
        sourceName: source.name,
        publishedAt: hit.created_at,
        summary: '',
        score: hit.points || 0,
      })
    )
    .filter(Boolean);
}

/** Reddit public JSON listing. Self-posts are skipped — we need a real article to analyse. */
async function collectReddit(source) {
  const json = JSON.parse(await fetchText(source.url, 'application/json'));
  return (json?.data?.children || [])
    .map((child) => child.data)
    .filter((post) => post && !post.is_self && !post.over_18 && post.url && (post.score || 0) >= (source.minScore || 0))
    .map((post) =>
      buildCandidate({
        title: post.title,
        url: post.url_overridden_by_dest || post.url,
        sourceName: source.name,
        publishedAt: new Date((post.created_utc || 0) * 1000).toISOString(),
        summary: post.selftext || '',
        image:
          post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') ||
          (typeof post.thumbnail === 'string' && post.thumbnail.startsWith('http') ? post.thumbnail : ''),
        score: post.score || 0,
      })
    )
    .filter(Boolean);
}

const COLLECTORS = {
  rss: collectRss,
  hackernews: collectHackerNews,
  reddit: collectReddit,
};

/**
 * Query every configured source. A failing source never aborts the run —
 * it is logged and the pipeline continues with whatever else responded.
 */
export async function collectCandidates(sources) {
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const collector = COLLECTORS[source.type];
      if (!collector) throw new Error(`Unknown source type "${source.type}"`);
      const items = await collector(source);
      log.info(`${source.name}: ${items.length} candidates`);
      return items.map((item) => ({ ...item, weight: source.weight ?? 1 }));
    })
  );

  const candidates = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') candidates.push(...result.value);
    else log.warn(`${sources[index].name} unavailable: ${result.reason?.message || result.reason}`);
  });

  // Collapse the same URL surfacing on multiple platforms, keeping the highest score.
  const byUrl = new Map();
  for (const candidate of candidates) {
    if (hoursSince(candidate.publishedAt) > PIPELINE.maxAgeHours) continue;
    const existing = byUrl.get(candidate.url);
    if (!existing) byUrl.set(candidate.url, candidate);
    else if (candidate.score > existing.score) {
      byUrl.set(candidate.url, { ...candidate, summary: candidate.summary || existing.summary, image: candidate.image || existing.image });
    }
  }

  return [...byUrl.values()];
}

export { fetchText };
