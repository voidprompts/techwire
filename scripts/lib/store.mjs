import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { PATHS, PIPELINE } from '../config.mjs';
import { clampText, hash, log, normalizeUrl, similarity, slugify, todayIso } from './utils.mjs';

/**
 * Paths are resolved lazily against the current working directory rather than
 * captured at import time, so the module honours CONTENT_ROOT and stays testable.
 */
function root() {
  return process.env.CONTENT_ROOT || process.cwd();
}

export function postsDir() {
  return path.join(root(), PATHS.postsDir);
}

function stateFile() {
  return path.join(root(), PATHS.stateFile);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * The repository is the database.
 * Load every existing post's title/URL so we never publish the same story twice.
 */
export function loadIndex() {
  const dir = postsDir();
  ensureDir(dir);

  const entries = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      try {
        const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf8'));
        return {
          slug: file.replace(/\.md$/, ''),
          title: String(data.title || ''),
          sourceUrl: normalizeUrl(String(data.source_url || data.sourceUrl || '')),
          date: String(data.date || ''),
        };
      } catch (error) {
        log.warn(`Skipping unreadable post ${file}: ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);

  // Previously-rejected URLs, so we don't re-fetch and re-reject them every run.
  let seen = { urls: [], updatedAt: null };
  const state = stateFile();
  if (fs.existsSync(state)) {
    try {
      seen = JSON.parse(fs.readFileSync(state, 'utf8'));
    } catch {
      log.warn('Scraper state file was corrupt — starting a fresh one.');
    }
  }

  return {
    posts: entries,
    slugs: new Set(entries.map((entry) => entry.slug)),
    urls: new Set([...entries.map((entry) => entry.sourceUrl).filter(Boolean), ...(seen.urls || [])]),
    titles: entries.map((entry) => entry.title).filter(Boolean),
  };
}

/**
 * Duplicate test: identical normalized source URL, or a title similar enough
 * to an existing headline to be the same story from a different outlet.
 */
export function findDuplicate(index, { title, url }) {
  const normalized = normalizeUrl(url);
  if (index.urls.has(normalized)) return { reason: 'source URL already published', match: normalized };

  for (const existing of index.posts) {
    const score = similarity(title, existing.title);
    if (score >= PIPELINE.duplicateThreshold) {
      return { reason: `title ${(score * 100).toFixed(0)}% similar to existing post`, match: existing.slug };
    }
  }
  return null;
}

/** Same check, but against stories queued earlier in this same run. */
export function isDuplicateOfBatch(batch, title) {
  return batch.some((item) => similarity(item.title, title) >= PIPELINE.duplicateThreshold);
}

/** Guarantee a filesystem-unique slug even if two stories normalize identically. */
export function uniqueSlug(index, title, url) {
  const base = slugify(title);
  if (!index.slugs.has(base)) return base;
  const suffixed = `${base}-${hash(url)}`;
  if (!index.slugs.has(suffixed)) return suffixed;
  let counter = 2;
  while (index.slugs.has(`${suffixed}-${counter}`)) counter += 1;
  return `${suffixed}-${counter}`;
}

/** YAML-escape a scalar for double-quoted front-matter. */
function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim()}"`;
}

function yamlList(values) {
  return `[${values.map((value) => yamlString(value)).join(', ')}]`;
}

/**
 * Write the article as a markdown file with the exact front-matter contract
 * consumed by lib/posts.js at build time.
 */
export function writePost({
  slug,
  title,
  description,
  keywords,
  category,
  image,
  imageCreditName,
  imageCreditUrl,
  sourceUrl,
  sourceName,
  body,
  date,
}) {
  const dir = postsDir();
  ensureDir(dir);

  const lines = [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(clampText(description, 155))}`,
    `date: ${yamlString(date || todayIso())}`,
    `keywords: ${yamlList(keywords)}`,
  ];

  // Section slug, when the model picked a valid one.
  if (category) lines.push(`category: ${yamlString(category)}`);

  lines.push(`image: ${yamlString(image || '')}`);

  // Image attribution is only emitted when we actually have a credit to give,
  // so hand-written posts and hotlinked fallbacks stay clean.
  if (imageCreditName && imageCreditUrl) {
    lines.push(`image_credit_name: ${yamlString(imageCreditName)}`);
    lines.push(`image_credit_url: ${yamlString(imageCreditUrl)}`);
  }

  lines.push(
    `source_url: ${yamlString(sourceUrl)}`,
    `source_name: ${yamlString(sourceName || '')}`,
    'author: "TechWire Editorial Desk"',
    '---',
    ''
  );

  const frontMatter = lines.join('\n');

  const filePath = path.join(dir, `${slug}.md`);
  fs.writeFileSync(filePath, `${frontMatter}${body.trim()}\n`, 'utf8');
  return path.relative(root(), filePath);
}

/** Persist processed URLs (published or rejected) so future runs skip them. */
export function saveState(index, processedUrls) {
  const state = stateFile();
  ensureDir(path.dirname(state));
  const urls = [...new Set([...index.urls, ...processedUrls])].slice(-4000);
  fs.writeFileSync(
    state,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), urls }, null, 2)}\n`,
    'utf8'
  );
}
