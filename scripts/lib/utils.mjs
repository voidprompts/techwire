import crypto from 'node:crypto';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const ACTIVE_LEVEL = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

function emit(level, icon, args) {
  if (LEVELS[level] < ACTIVE_LEVEL) return;
  const stamp = new Date().toISOString().slice(11, 19);
  const line = [`${icon} [${stamp}]`, ...args];
  if (level === 'error') console.error(...line);
  else if (level === 'warn') console.warn(...line);
  else console.log(...line);
}

export const log = {
  debug: (...a) => emit('debug', '·', a),
  info: (...a) => emit('info', '›', a),
  step: (...a) => emit('info', '▸', a),
  success: (...a) => emit('info', '✓', a),
  warn: (...a) => emit('warn', '!', a),
  error: (...a) => emit('error', '✗', a),
};

/** URL-safe slug, truncated on a word boundary. */
export function slugify(input, maxLength = 70) {
  const base = String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base.length <= maxLength) return base || 'untitled';
  const cut = base.slice(0, maxLength);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '') || 'untitled';
}

/** Strip tracking params and fragments so the same article always yields one key. */
export function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    const junk = [...url.searchParams.keys()].filter(
      (key) => /^(utm_|ref_?|fbclid|gclid|mc_|igshid|_hs|spm|source|cmpid|ncid)/i.test(key)
    );
    junk.forEach((key) => url.searchParams.delete(key));
    url.hostname = url.hostname.replace(/^www\./, '');
    let out = url.toString();
    if (out.endsWith('/') && url.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return String(rawUrl || '').trim();
  }
}

export function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function hash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
}

/** Words used for similarity comparison — stopwords and punctuation removed. */
const STOPWORDS = new Set(
  `a an and are as at be by for from has have how in is it its of on or that the to was were will with this
   new report says say said after before over under into out up down more most than then they their them we you`
    .split(/\s+/)
    .filter(Boolean)
);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/** Jaccard similarity over significant tokens. 1 = identical. */
export function similarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  return intersection / (setA.size + setB.size - intersection);
}

export function countWords(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

export function truncateWords(text, maxWords) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

/** Clamp to a max char length, cutting at the last sentence or word boundary. */
export function clampText(text, maxChars) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > maxChars * 0.6) return cut.slice(0, sentenceEnd + 1).trim();
  const wordEnd = cut.lastIndexOf(' ');
  return `${cut.slice(0, wordEnd > 0 ? wordEnd : maxChars).trim()}…`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function hoursSince(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.valueOf())) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / 36e5;
}

/** Decode the HTML entities that show up in RSS titles and descriptions. */
export function decodeEntities(text = '') {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
    mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
    middot: '·', bull: '•', deg: '°', copy: '©', reg: '®', trade: '™', eacute: 'é',
  };
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Remove tags/scripts/styles from an HTML fragment and collapse whitespace. */
export function stripHtml(html = '') {
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Retry an async operation with exponential backoff + jitter. */
export async function withRetry(fn, { retries = 3, baseDelay = 800, label = 'operation' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (error?.fatal || attempt === retries) break;
      const delay = Math.round(baseDelay * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5));
      log.warn(`${label} failed (attempt ${attempt}/${retries}): ${error.message}. Retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastError;
}

/** fetch() with a hard timeout and sane default headers. */
export async function fetchWithTimeout(url, { timeoutMs = 20000, headers = {}, ...init } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'accept-language': 'en-US,en;q=0.9',
        ...headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
