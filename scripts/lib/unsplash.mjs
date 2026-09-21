import fs from 'node:fs';
import path from 'node:path';
import { PIPELINE } from '../config.mjs';
import { fetchWithTimeout, log, withRetry } from './utils.mjs';

/**
 * Unsplash feature-image provider.
 *
 * Why this exists: hotlinking a publisher's Open Graph image reproduces a
 * copyrighted asset we have no licence to, which is exactly the kind of thing
 * AdSense review flags. Unsplash images carry a licence that permits commercial
 * use, so they are the safe default for a feature image.
 *
 * API guideline compliance (https://help.unsplash.com/en/articles/2511245):
 *  - attribute the photographer by name, linked to their profile;
 *  - append utm_source / utm_medium to every link back to Unsplash;
 *  - trigger the `links.download_location` endpoint whenever an image is used.
 * All three are handled here.
 */

const API_BASE = 'https://api.unsplash.com';
const UTM_SOURCE = process.env.UNSPLASH_APP_NAME || 'techwire';
const UTM = `utm_source=${encodeURIComponent(UTM_SOURCE)}&utm_medium=referral`;

/** Public Unsplash link with the required referral parameters attached. */
export function withUtm(url) {
  if (!url) return '';
  return url.includes('?') ? `${url}&${UTM}` : `${url}?${UTM}`;
}

export const UNSPLASH_HOME = withUtm('https://unsplash.com');

export function isEnabled() {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

function root() {
  return process.env.CONTENT_ROOT || process.cwd();
}

/** Public URL path and on-disk directory for downloaded thumbnails. */
export const THUMBNAIL_URL_DIR = '/images/thumbnails';

function thumbnailDir() {
  return path.join(root(), 'public', 'images', 'thumbnails');
}

function authHeaders() {
  return {
    Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
    'Accept-Version': 'v1',
    'user-agent': PIPELINE.userAgent,
  };
}

async function apiGet(url) {
  return withRetry(
    async () => {
      const response = await fetchWithTimeout(url, {
        timeoutMs: PIPELINE.requestTimeoutMs,
        headers: authHeaders(),
      });
      if (!response.ok) {
        const error = new Error(`Unsplash HTTP ${response.status}`);
        // 401/403 = bad key or exhausted quota; retrying will not help.
        if ([400, 401, 403, 404].includes(response.status)) error.fatal = true;
        throw error;
      }
      return response.json();
    },
    { retries: 2, baseDelay: 1200, label: 'unsplash api' }
  );
}

/**
 * Build an Unsplash search query from 2-3 technical keywords.
 * Overly long queries return nothing on Unsplash, so this caps the terms,
 * drops duplicates, and strips punctuation that hurts matching.
 */
export function buildQuery(keywords) {
  const terms = (Array.isArray(keywords) ? keywords : [keywords])
    .flatMap((k) => String(k || '').split(/[,/]+/))
    .map((k) => k.replace(/[^a-zA-Z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean);

  const unique = [];
  for (const term of terms) {
    if (unique.some((existing) => existing === term || existing.includes(term) || term.includes(existing))) continue;
    unique.push(term);
    if (unique.length === 3) break;
  }
  return unique.join(' ');
}

/**
 * Search for a landscape photo matching the article's subject.
 * Returns the raw API result, or null when nothing suitable is found.
 */
export async function searchPhoto(query) {
  const url =
    `${API_BASE}/search/photos` +
    `?query=${encodeURIComponent(query)}` +
    '&per_page=10&orientation=landscape&content_filter=high';

  const json = await apiGet(url);
  const results = Array.isArray(json?.results) ? json.results : [];
  if (results.length === 0) return null;

  // Prefer a photo that actually carries attribution data we can render.
  return (
    results.find(
      (photo) => photo?.user?.name && photo?.user?.links?.html && (photo?.urls?.regular || photo?.urls?.raw)
    ) || null
  );
}

/**
 * Map an Unsplash API photo object onto our attribution fields.
 * Exported separately so it can be unit-tested without network access.
 */
export function toAttribution(photo) {
  if (!photo?.user) return null;
  const name = String(photo.user.name || '').trim();
  const profile = String(photo.user.links?.html || '').trim();
  if (!name || !profile) return null;
  return {
    creditName: name,
    // Photographer profile URL carrying the required referral parameters.
    creditUrl: withUtm(profile),
    downloadLocation: photo.links?.download_location || '',
    // Spec calls for urls.regular (a ready-sized ~1080px JPEG). urls.raw is kept
    // as a fallback because it accepts explicit sizing parameters.
    imageUrl: photo.urls?.regular || photo.urls?.raw || photo.urls?.full || '',
    isRaw: !photo.urls?.regular && Boolean(photo.urls?.raw),
    altDescription: photo.alt_description || photo.description || '',
    id: photo.id || '',
  };
}

/**
 * Required by the Unsplash API guidelines: ping the download endpoint whenever
 * a photo is actually used. Never throws — a failed ping must not lose an article.
 */
async function triggerDownload(downloadLocation) {
  if (!downloadLocation) return;
  try {
    await fetchWithTimeout(downloadLocation, {
      timeoutMs: PIPELINE.requestTimeoutMs,
      headers: authHeaders(),
    });
    log.debug('  unsplash: download endpoint triggered');
  } catch (error) {
    log.warn(`  unsplash: could not trigger download endpoint (${error.message})`);
  }
}

/** Download the JPEG to public/images/thumbnails/<slug>.jpg. */
async function downloadImage(imageUrl, slug, { isRaw = false } = {}) {
  // urls.regular is already a sized, compressed JPEG and is used as-is.
  // Only the raw fallback needs explicit sizing parameters appended.
  let target = imageUrl;
  if (isRaw) {
    const separator = imageUrl.includes('?') ? '&' : '?';
    target = `${imageUrl}${separator}w=1200&h=675&fit=crop&crop=entropy&q=75&fm=jpg`;
  }

  const response = await fetchWithTimeout(target, {
    timeoutMs: 45000,
    headers: { 'user-agent': PIPELINE.userAgent },
  });
  if (!response.ok) throw new Error(`image download HTTP ${response.status}`);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`unexpected content-type ${contentType}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 2048) throw new Error(`image suspiciously small (${buffer.length} bytes)`);

  const dir = thumbnailDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${slug}.jpg`);
  fs.writeFileSync(filePath, buffer);

  return {
    // Site-root-relative public path, as stored in front-matter.
    publicPath: `${THUMBNAIL_URL_DIR}/${slug}.jpg`,
    bytes: buffer.length,
    filePath,
  };
}

/**
 * Find, license-track and download a feature image for an article.
 *
 * Returns { image, imageCreditName, imageCreditUrl } on success, or null so the
 * caller can fall back. Never throws — an image problem must never drop a story.
 */
export async function fetchFeatureImage({ query, slug }) {
  if (!isEnabled()) return null;
  if (!query || !slug) return null;

  try {
    // Try the full 2-3 keyword query first, then progressively broaden, since
    // specific technical phrases often have no stock photography match.
    let photo = null;
    const attempts = [...new Set([query, query.split(' ').slice(0, 2).join(' '), query.split(' ')[0], 'technology'])].filter(Boolean);
    for (const attempt of attempts) {
      photo = await searchPhoto(attempt);
      if (photo) {
        if (attempt !== query) log.debug(`  unsplash: broadened query to "${attempt}"`);
        break;
      }
    }
    if (!photo) {
      log.warn(`  unsplash: no results for "${query}"`);
      return null;
    }

    const attribution = toAttribution(photo);
    if (!attribution) {
      log.warn('  unsplash: result missing attribution fields — skipping');
      return null;
    }

    // Guideline requirement: register the download before using the image.
    await triggerDownload(attribution.downloadLocation);

    const downloaded = await downloadImage(attribution.imageUrl, slug, { isRaw: attribution.isRaw });
    log.info(
      `  unsplash: ${downloaded.publicPath} (${Math.round(downloaded.bytes / 1024)}KB) by ${attribution.creditName}`
    );

    return {
      image: downloaded.publicPath,
      imageCreditName: attribution.creditName,
      imageCreditUrl: attribution.creditUrl,
      altDescription: attribution.altDescription,
    };
  } catch (error) {
    log.warn(`  unsplash: feature image unavailable (${error.message})`);
    return null;
  }
}

/** Remove a downloaded thumbnail — used to clean up if the article write fails. */
export function removeThumbnail(slug) {
  try {
    const filePath = path.join(thumbnailDir(), `${slug}.jpg`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Best effort only.
  }
}
