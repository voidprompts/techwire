#!/usr/bin/env node
/**
 * TechWire autopilot scraper.
 *
 * Pipeline:
 *   1. Collect candidates from RSS feeds, Hacker News and Reddit.
 *   2. Reject duplicates against /content/posts (the repo IS the database).
 *   3. Extract readable body text from the source page.
 *   4. Send it to the free AI tier (Gemini 1.5 Flash or Groq) for an original,
 *      SEO-structured, AdSense-policy-compliant rewrite.
 *   5. Write the result as a markdown file with the front-matter contract.
 *
 * Usage:
 *   node scripts/scrape.mjs
 *   node scripts/scrape.mjs --dry-run --limit 2
 *
 * Env:
 *   GEMINI_API_KEY | GROQ_API_KEY   (one required unless --dry-run)
 *   AI_PROVIDER=gemini|groq         (optional, auto-detected)
 *   MAX_POSTS_PER_RUN, MAX_AGE_HOURS, LOG_LEVEL
 */

import process from 'node:process';
import { BLOCKED_DOMAINS, PIPELINE, SOURCES } from './config.mjs';
import { generateArticle, resolveProvider } from './lib/ai.mjs';
import { extractArticle } from './lib/extract.mjs';
import { collectCandidates } from './lib/sources.mjs';
import { fetchFeatureImage, isEnabled as unsplashEnabled, removeThumbnail } from './lib/unsplash.mjs';
import {
  findDuplicate,
  isDuplicateOfBatch,
  loadIndex,
  saveState,
  uniqueSlug,
  writePost,
} from './lib/store.mjs';
import { clampText, hoursSince, log, sleep, todayIso } from './lib/utils.mjs';

function parseArgs(argv) {
  const args = { dryRun: false, limit: PIPELINE.maxPostsPerRun, provider: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run' || arg === '-n') args.dryRun = true;
    else if (arg === '--limit' || arg === '-l') args.limit = Number(argv[++i]) || args.limit;
    else if (arg === '--provider' || arg === '-p') args.provider = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`
TechWire scraper

  node scripts/scrape.mjs [options]

  -n, --dry-run          Collect and rank candidates without calling the AI or writing files
  -l, --limit <n>        Max articles to publish this run (default ${PIPELINE.maxPostsPerRun})
  -p, --provider <name>  Force "gemini" or "groq"
  -h, --help             Show this message
`);
}

function isBlockedDomain(domain) {
  return BLOCKED_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

/**
 * Rank candidates: community score, source diversity bonus, and freshness.
 * Higher is better.
 */
function rankCandidates(candidates) {
  return candidates
    .map((candidate) => {
      const ageHours = hoursSince(candidate.publishedAt);
      const freshness = Math.max(0, 1 - ageHours / PIPELINE.maxAgeHours);
      const popularity = Math.log10((candidate.score || 0) + 10) / 4;
      const richness = candidate.summary ? 0.12 : 0;
      const imageBonus = candidate.image ? 0.08 : 0;
      return {
        ...candidate,
        rank: freshness * 0.55 + popularity * 0.45 + richness + imageBonus + (candidate.weight ?? 1) * 0.05,
      };
    })
    .sort((a, b) => b.rank - a.rank);
}

/** Interleave outlets so one prolific feed cannot dominate a single run. */
function diversify(candidates) {
  const buckets = new Map();
  for (const candidate of candidates) {
    const key = candidate.domain || candidate.sourceName;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(candidate);
  }
  const queues = [...buckets.values()];
  const ordered = [];
  let index = 0;
  while (ordered.length < candidates.length) {
    const queue = queues[index % queues.length];
    if (queue.length) ordered.push(queue.shift());
    index += 1;
    if (queues.every((q) => q.length === 0)) break;
  }
  return ordered;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const startedAt = Date.now();
  log.step(`TechWire scraper starting — ${args.dryRun ? 'DRY RUN' : 'LIVE'}`);

  let provider = null;
  if (!args.dryRun) {
    provider = args.provider || resolveProvider();
    log.info(`AI provider: ${provider}`);
    log.info(
      unsplashEnabled()
        ? 'Feature images: Unsplash (licensed, attributed)'
        : 'Feature images: source Open Graph fallback (set UNSPLASH_ACCESS_KEY for licensed images)'
    );
  }

  // ---- 1. Load existing corpus (the Git repo is our database) ----
  const index = loadIndex();
  log.info(`Existing posts: ${index.posts.length}`);

  // ---- 2. Collect ----
  log.step('Collecting candidates…');
  const collected = await collectCandidates(SOURCES);
  log.info(`Collected ${collected.length} unique, in-window candidates`);

  if (collected.length === 0) {
    log.warn('No candidates found. Exiting cleanly.');
    return;
  }

  // ---- 3. Filter + rank ----
  const eligible = collected.filter((candidate) => {
    if (isBlockedDomain(candidate.domain)) {
      log.debug(`skip (blocked domain ${candidate.domain}): ${candidate.title}`);
      return false;
    }
    const duplicate = findDuplicate(index, candidate);
    if (duplicate) {
      log.debug(`skip (${duplicate.reason}): ${candidate.title}`);
      return false;
    }
    return true;
  });

  log.info(`${eligible.length} candidates survived de-duplication and domain filters`);
  const queue = diversify(rankCandidates(eligible));

  if (args.dryRun) {
    log.step(`Top ${Math.min(args.limit * 3, queue.length)} ranked candidates:`);
    queue.slice(0, args.limit * 3).forEach((candidate, i) => {
      console.log(
        `  ${String(i + 1).padStart(2)}. [${candidate.rank.toFixed(3)}] ${candidate.sourceName} — ${candidate.title}\n      ${candidate.url}`
      );
    });
    log.success('Dry run complete. No files written, no AI calls made.');
    return;
  }

  // ---- 4. Process the queue until we hit the publish limit ----
  const published = [];
  const processedUrls = [];
  let attempts = 0;
  const maxAttempts = Math.min(queue.length, args.limit * 5);

  for (const candidate of queue) {
    if (published.length >= args.limit) break;
    if (attempts >= maxAttempts) break;
    attempts += 1;

    log.step(`[${published.length + 1}/${args.limit}] ${candidate.title}`);
    log.info(`  source: ${candidate.url}`);

    try {
      await sleep(PIPELINE.requestDelayMs);

      // 4a. Extract readable source text
      const article = await extractArticle(candidate.url);
      if (!article || article.charCount < PIPELINE.minSourceChars) {
        log.warn(`  skipped — only ${article?.charCount ?? 0} usable chars extracted`);
        processedUrls.push(candidate.url);
        continue;
      }
      log.info(`  extracted ${article.charCount} chars`);

      // 4b. Transform with the free AI tier
      const generated = await generateArticle(
        {
          sourceTitle: article.title || candidate.title,
          sourceName: article.siteName || candidate.sourceName,
          sourceUrl: candidate.url,
          publishedAt: article.publishedAt || candidate.publishedAt,
          text: article.trimmedText,
        },
        provider
      );

      if (generated.confidence < 0.4) {
        log.warn(`  skipped — model confidence ${generated.confidence} below threshold`);
        processedUrls.push(candidate.url);
        continue;
      }

      // 4c. Final duplicate guard against titles generated earlier in this run
      if (isDuplicateOfBatch(published, generated.title)) {
        log.warn('  skipped — near-duplicate of a story already queued this run');
        processedUrls.push(candidate.url);
        continue;
      }

      const slug = uniqueSlug(index, generated.title, candidate.url);

      // 4d. Feature image.
      // Prefer a licensed Unsplash photo with full attribution over hotlinking
      // the publisher's own copyrighted Open Graph image.
      let image = article.image || candidate.image || '';
      let imageCreditName = '';
      let imageCreditUrl = '';

      const unsplashImage = await fetchFeatureImage({
        query: generated.primaryKeyword || generated.keywords[0] || 'technology',
        slug,
      });
      if (unsplashImage) {
        image = unsplashImage.image;
        imageCreditName = unsplashImage.imageCreditName;
        imageCreditUrl = unsplashImage.imageCreditUrl;
      }

      // 4e. Persist as markdown
      let relativePath;
      try {
        relativePath = writePost({
          slug,
          title: generated.title,
          description: clampText(generated.description, 155),
          keywords: generated.keywords,
          image,
          imageCreditName,
          imageCreditUrl,
          sourceUrl: candidate.url,
          sourceName: article.siteName || candidate.sourceName,
          body: generated.body,
          date: todayIso(),
        });
      } catch (writeError) {
        // Do not leave an orphaned thumbnail behind if the markdown write fails.
        if (unsplashImage) removeThumbnail(slug);
        throw writeError;
      }

      // Keep the in-memory index current so later iterations dedupe correctly.
      index.slugs.add(slug);
      index.urls.add(candidate.url);
      index.posts.push({ slug, title: generated.title, sourceUrl: candidate.url, date: todayIso() });

      published.push({ slug, title: generated.title, path: relativePath, words: generated.wordCount });
      processedUrls.push(candidate.url);
      log.success(`  published ${relativePath} (${generated.wordCount} words)`);
    } catch (error) {
      log.error(`  failed: ${error.message}`);
      processedUrls.push(candidate.url);
      // A fatal provider error (bad key, quota, safety block config) ends the run.
      if (error.fatal) {
        log.error('Fatal provider error — stopping the run early.');
        break;
      }
    }
  }

  saveState(index, processedUrls);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log.step(`Run complete in ${seconds}s — ${published.length} article(s) published`);
  published.forEach((item) => log.info(`  • ${item.title} → ${item.path}`));

  // Surface the count to the GitHub Actions workflow.
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `published_count=${published.length}\n`);
  }
}

main().catch((error) => {
  log.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
