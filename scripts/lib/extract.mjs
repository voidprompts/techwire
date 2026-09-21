import { PIPELINE } from '../config.mjs';
import { clampText, decodeEntities, fetchWithTimeout, log, stripHtml, withRetry } from './utils.mjs';

/**
 * Dependency-free readability-style extractor.
 * Downloads the article HTML, removes chrome, then scores block candidates by
 * paragraph density to find the main body text.
 */

const STRIP_BLOCKS =
  /<(script|style|noscript|iframe|svg|form|nav|aside|header|footer|figure|figcaption|video|audio|template|button|select)\b[^>]*>[\s\S]*?<\/\1>/gi;

const NEGATIVE = /(comment|share|social|promo|newsletter|subscribe|related|recirc|sidebar|footer|header|nav|menu|breadcrumb|advert|sponsor|paywall|cookie|tag-list|author-bio|meta|widget|popup|modal)/i;

const BOILERPLATE = [
  /^sign up for/i,
  /^subscribe to/i,
  /^follow us on/i,
  /^read more:/i,
  /^related:/i,
  /^advertisement$/i,
  /^share this article/i,
  /^this article originally appeared/i,
  /^all products featured/i,
  /cookie(s)? (policy|settings)/i,
  /^photo(graph)? by/i,
  /^image credit/i,
  /^getty images$/i,
];

/** Pull <meta> values, trying every common naming convention. */
function readMeta(html, names) {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${name}["']`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]?.trim()) return decodeEntities(match[1].trim());
    }
  }
  return '';
}

function absoluteUrl(url, baseUrl) {
  if (!url) return '';
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return '';
  }
}

/** Extract published date from meta tags or JSON-LD. */
function readPublishedDate(html) {
  const meta = readMeta(html, [
    'article:published_time',
    'datePublished',
    'og:published_time',
    'publish-date',
    'date',
  ]);
  if (meta) return meta;
  const ld = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  return ld?.[1] || '';
}

function isBoilerplate(text) {
  return BOILERPLATE.some((pattern) => pattern.test(text.trim()));
}

/**
 * Score every <article>/<div>/<section> block by how much real paragraph text it
 * contains, penalising navigational/promotional class names. Highest score wins.
 */
function selectMainBlock(html) {
  const blockPattern = /<(article|main|div|section)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let best = { score: 0, html: '' };
  let match;

  while ((match = blockPattern.exec(html)) !== null) {
    const attrs = match[2] || '';
    const inner = match[3] || '';
    if (inner.length < 400) continue;

    const paragraphs = inner.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
    if (paragraphs.length < 3) continue;

    const textLength = paragraphs.reduce((sum, p) => sum + stripHtml(p).length, 0);
    if (textLength < 400) continue;

    const linkCount = (inner.match(/<a\b/gi) || []).length;
    const linkPenalty = Math.min(0.6, (linkCount / Math.max(paragraphs.length, 1)) * 0.12);
    let score = textLength * (1 - linkPenalty);
    if (NEGATIVE.test(attrs)) score *= 0.35;
    if (/article|post|story|content|entry|body|prose/i.test(attrs)) score *= 1.35;
    if (match[1].toLowerCase() === 'article') score *= 1.25;

    if (score > best.score) best = { score, html: inner };
  }

  return best.html;
}

function paragraphsFrom(blockHtml) {
  const raw = blockHtml.match(/<(p|h2|h3|li)\b[^>]*>[\s\S]*?<\/\1>/gi) || [];
  return raw
    .map((chunk) => stripHtml(chunk))
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 45)
    .filter((text) => !isBoilerplate(text));
}

/**
 * Fetch and extract the readable content of an article URL.
 * Returns null when the page cannot be fetched or has too little usable text.
 */
export async function extractArticle(url) {
  let html;
  try {
    html = await withRetry(
      async () => {
        const response = await fetchWithTimeout(url, {
          timeoutMs: PIPELINE.requestTimeoutMs,
          headers: {
            'user-agent': PIPELINE.userAgent,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          if (response.status >= 400 && response.status < 500 && response.status !== 429) error.fatal = true;
          throw error;
        }
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('html')) {
          const error = new Error(`Unsupported content-type: ${contentType}`);
          error.fatal = true;
          throw error;
        }
        return response.text();
      },
      { retries: 2, label: `extract ${url}` }
    );
  } catch (error) {
    log.warn(`Could not fetch article body: ${url} (${error.message})`);
    return null;
  }

  const cleaned = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(STRIP_BLOCKS, ' ');

  const metaTitle =
    readMeta(cleaned, ['og:title', 'twitter:title']) ||
    decodeEntities(stripHtml(cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''));
  const metaDescription = readMeta(cleaned, ['og:description', 'twitter:description', 'description']);
  const metaImage = absoluteUrl(
    readMeta(cleaned, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src', 'image']),
    url
  );
  const siteName = readMeta(cleaned, ['og:site_name', 'application-name']);
  const publishedAt = readPublishedDate(cleaned);

  const block = selectMainBlock(cleaned);
  let paragraphs = paragraphsFrom(block || cleaned);

  // Fallback: if block selection failed, take every paragraph on the page.
  if (paragraphs.length < 3) {
    paragraphs = paragraphsFrom(cleaned);
  }

  const text = paragraphs.join('\n\n');

  return {
    url,
    title: metaTitle,
    description: metaDescription,
    image: metaImage,
    siteName,
    publishedAt,
    text,
    // Cap what we send to the AI so a single long article cannot blow the token budget.
    trimmedText: clampText(text, 9000),
    charCount: text.length,
  };
}
