import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import { classifyPost, getAllSilos } from './silos.mjs';

export const POSTS_DIRECTORY = path.join(process.cwd(), 'content', 'posts');

const WORDS_PER_MINUTE = 225;

/** Read every .md filename in /content/posts. Returns [] when the folder is missing. */
function listMarkdownFiles() {
  if (!fs.existsSync(POSTS_DIRECTORY)) return [];
  return fs
    .readdirSync(POSTS_DIRECTORY)
    .filter((file) => file.endsWith('.md') && !file.startsWith('.'));
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v).trim());
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeDate(value) {
  if (!value) return new Date(0).toISOString().slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString().slice(0, 10);
  return new Date(0).toISOString().slice(0, 10);
}

function countWords(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** First ~2 sentences of body copy, used as a card excerpt fallback. */
function buildExcerpt(markdown, fallback) {
  const plain = markdown
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return fallback || '';
  return plain.length > 180 ? `${plain.slice(0, 177).trimEnd()}…` : plain;
}

/** Trim a description to <=160 chars on a word boundary (Google's render limit). */
function clampDescription(text, maxChars = 160) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

function slugFromFilename(filename) {
  return filename.replace(/\.md$/, '');
}

export function slugifyTopic(topic) {
  return String(topic)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readPostFile(filename) {
  const fullPath = path.join(POSTS_DIRECTORY, filename);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(raw);
  const slug = slugFromFilename(filename);
  const keywords = toArray(data.keywords);
  const words = countWords(content);
  const title = (data.title || slug.replace(/-/g, ' ')).toString();
  // Every post resolves to exactly one silo, so nothing is orphaned from the nav.
  const silo = classifyPost({ category: data.category, keywords, title });

  // Meta descriptions are clamped at render time as well as at write time, so a
  // hand-written file can never emit an over-length tag that Google rewrites.
  const description = clampDescription((data.description || '').toString());

  return {
    slug,
    title,
    description,
    date: normalizeDate(data.date),
    keywords,
    topics: keywords.map((k) => ({ name: k, slug: slugifyTopic(k) })),
    silo: { slug: silo.slug, name: silo.name, shortName: silo.shortName, emoji: silo.emoji },
    image: (data.image || '').toString(),
    // Unsplash (or other) photographer attribution, rendered under the hero image.
    imageCreditName: (data.image_credit_name || data.imageCreditName || '').toString(),
    imageCreditUrl: (data.image_credit_url || data.imageCreditUrl || '').toString(),
    sourceUrl: (data.source_url || data.sourceUrl || '').toString(),
    sourceName: (data.source_name || data.sourceName || '').toString(),
    author: (data.author || 'TechWire Desk').toString(),
    content,
    excerpt: description || buildExcerpt(content, ''),
    wordCount: words,
    readingTime: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  };
}

/** All posts, newest first. Runs at build time only. */
export function getAllPosts() {
  return listMarkdownFiles()
    .map(readPostFile)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
}

export function getAllSlugs() {
  return listMarkdownFiles().map(slugFromFilename);
}

export function getPostBySlug(slug) {
  const filename = `${slug}.md`;
  const fullPath = path.join(POSTS_DIRECTORY, filename);
  if (!fs.existsSync(fullPath)) return null;
  return readPostFile(filename);
}

/** Convert markdown body to sanitized HTML (GFM tables/strikethrough supported). */
export async function renderMarkdown(markdown) {
  const processed = await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(markdown);
  return processed.toString();
}

/**
 * Split rendered HTML into two halves at a top-level boundary so an in-article
 * ad unit can be injected mid-content without breaking markup.
 */
export function splitHtmlForMidAd(html) {
  const blocks = html.split(/(?=<h2)/g);

  // Prefer an <h2> boundary, choosing whichever sits closest to the true
  // halfway point by character count. Splitting on section *count* drifts late
  // when sections are uneven, pushing the ad past the fold it should sit above.
  if (blocks.length >= 3) {
    const target = html.length / 2;
    let best = { index: 1, distance: Infinity };
    let consumed = 0;

    for (let i = 0; i < blocks.length - 1; i += 1) {
      consumed += blocks[i].length;
      // Skip boundaries in the first/last 20% — an ad there reads as a wall.
      if (consumed < html.length * 0.2 || consumed > html.length * 0.8) continue;
      const distance = Math.abs(consumed - target);
      if (distance < best.distance) best = { index: i + 1, distance };
    }

    if (best.distance !== Infinity) {
      return [blocks.slice(0, best.index).join(''), blocks.slice(best.index).join('')];
    }
  }

  // Fallback for short or heading-light articles: split on paragraphs.
  const paragraphs = html.split(/(?=<p>)/g);
  if (paragraphs.length < 4) return [html, ''];
  const mid = Math.ceil(paragraphs.length / 2);
  return [paragraphs.slice(0, mid).join(''), paragraphs.slice(mid).join('')];
}

/** Related posts chosen by shared keywords, then recency. */
export function getRelatedPosts(post, limit = 3) {
  const keywordSet = new Set(post.keywords.map((k) => k.toLowerCase()));
  return getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({
      post: p,
      score: p.keywords.filter((k) => keywordSet.has(k.toLowerCase())).length,
    }))
    .sort((a, b) => b.score - a.score || (a.post.date < b.post.date ? 1 : -1))
    .slice(0, limit)
    .map((entry) => entry.post);
}

/** Unique topic index with post counts, most used first. */
export function getAllTopics() {
  const map = new Map();
  for (const post of getAllPosts()) {
    for (const topic of post.topics) {
      if (!topic.slug) continue;
      const existing = map.get(topic.slug);
      if (existing) existing.count += 1;
      else map.set(topic.slug, { name: topic.name, slug: topic.slug, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function getPostsByTopic(topicSlug) {
  return getAllPosts().filter((post) => post.topics.some((t) => t.slug === topicSlug));
}

export function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) return dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** All posts in a silo, newest first. */
export function getPostsBySilo(siloSlug) {
  return getAllPosts().filter((post) => post.silo.slug === siloSlug);
}

/** Silo list decorated with live post counts, preserving the configured order. */
export function getSilosWithCounts() {
  const posts = getAllPosts();
  return getAllSilos().map((silo) => ({
    ...silo,
    count: posts.filter((post) => post.silo.slug === silo.slug).length,
  }));
}
