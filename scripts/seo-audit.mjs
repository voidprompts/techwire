#!/usr/bin/env node
/**
 * SEO regression audit — runs against the built ./out directory.
 *
 * Every check here corresponds to a defect that was actually found in the
 * rendered output at some point. Source-level assertions would not have caught
 * most of them: the bugs lived in what Next emitted, not in what we wrote.
 *
 *   npm run build && node scripts/seo-audit.mjs
 *   node scripts/seo-audit.mjs --dir out
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir');
const OUT = path.resolve(process.cwd(), dirArg >= 0 ? args[dirArg + 1] : 'out');

if (!fs.existsSync(OUT)) {
  console.error(`seo-audit: ${OUT} not found — run \`npm run build\` first.`);
  process.exit(1);
}

let failures = 0;
let checks = 0;

function check(label, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`);
  }
}

/** Every index.html in the export, as site-relative page paths. */
function htmlPages(dir = OUT, base = '') {
  const pages = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name === '404') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pages.push(...htmlPages(full, `${base}/${entry.name}`));
    } else if (entry.name === 'index.html') {
      pages.push({ route: `${base}/` || '/', file: full });
    }
  }
  return pages;
}

const read = (file) => fs.readFileSync(file, 'utf8');
const attr = (html, re) => (html.match(re) || [])[1] || '';

const canonicalOf = (html) => attr(html, /<link rel="canonical" href="([^"]+)"/);
const ogImageOf = (html) => attr(html, /<meta property="og:image" content="([^"]+)"/);
const robotsOf = (html) => attr(html, /<meta name="robots" content="([^"]+)"/);
const jsonLdOf = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) =>
    JSON.parse(m[1].replace(/\\u003c/g, '<'))
  );

/** Walk a parsed JSON-LD tree, yielding every object node. */
function* nodes(value) {
  if (Array.isArray(value)) {
    for (const item of value) yield* nodes(item);
  } else if (value && typeof value === 'object') {
    yield value;
    for (const item of Object.values(value)) yield* nodes(item);
  }
}

const pages = htmlPages();
const sitemap = read(path.join(OUT, 'sitemap.xml'));
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const origin = new URL(sitemapUrls[0] || 'https://example.com').origin;
const toRoute = (url) => new URL(url).pathname;

console.log(`\nseo-audit: ${pages.length} pages in ${path.relative(process.cwd(), OUT)}\n`);

// 1 — Sitemap URLs must match canonical form (trailingSlash: true), or every
//     sitemap entry 301s and Search Console flags the whole file.
console.log('sitemap ↔ canonical agreement');
{
  const bad = sitemapUrls.filter((url) => {
    const p = toRoute(url);
    return !p.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(p);
  });
  check('every sitemap URL uses the canonical trailing-slash form', bad.length === 0, bad.join(', '));

  const canonicalSet = new Set(
    pages.map((p) => canonicalOf(read(p.file))).filter(Boolean).map(toRoute)
  );
  const orphans = sitemapUrls.map(toRoute).filter((p) => !canonicalSet.has(p));
  check('every sitemap URL is the canonical of a real page', orphans.length === 0, orphans.join(', '));
}

// 2 — Canonicals must be absolute and self-referential.
console.log('\ncanonicals');
{
  const missing = pages.filter((p) => !canonicalOf(read(p.file)));
  check('every page declares a canonical', missing.length === 0, missing.map((p) => p.route).join(', '));

  const relative = pages.filter((p) => {
    const c = canonicalOf(read(p.file));
    return c && !c.startsWith('http');
  });
  check('every canonical is absolute', relative.length === 0, relative.map((p) => p.route).join(', '));

  const mismatched = pages.filter((p) => {
    const c = canonicalOf(read(p.file));
    return c && toRoute(c) !== p.route;
  });
  check(
    'every canonical is self-referential',
    mismatched.length === 0,
    mismatched.map((p) => `${p.route} -> ${toRoute(canonicalOf(read(p.file)))}`).join(', ')
  );
}

// 3 — Share cards. A page with no og:image renders as a bare link everywhere.
console.log('\nopen graph');
{
  const noImage = pages.filter((p) => !ogImageOf(read(p.file)));
  check('every page has an og:image', noImage.length === 0, noImage.map((p) => p.route).join(', '));

  const relative = pages.filter((p) => {
    const i = ogImageOf(read(p.file));
    return i && !i.startsWith('http');
  });
  check('every og:image is absolute', relative.length === 0, relative.map((p) => p.route).join(', '));

  const localImages = new Set(
    pages.map((p) => ogImageOf(read(p.file))).filter((u) => u.startsWith(origin))
  );
  const missingFiles = [...localImages].filter(
    (u) => !fs.existsSync(path.join(OUT, decodeURIComponent(new URL(u).pathname)))
  );
  check('every og:image resolves to a real file', missingFiles.length === 0, missingFiles.join(', '));
}

// 4 — Icons. No favicon means a generic globe in results and in tabs.
console.log('\nicons');
{
  for (const file of ['favicon.ico', 'apple-icon.png', 'images/brand/icon-192.png', 'images/brand/icon-512.png']) {
    check(`/${file} exists`, fs.existsSync(path.join(OUT, file)));
  }
  const home = read(path.join(OUT, 'index.html'));
  check('homepage links a favicon', /<link rel="(shortcut )?icon"/.test(home));
  check('homepage links an apple-touch-icon', /rel="apple-touch-icon"/.test(home));
  check('homepage links a web manifest', /<link rel="manifest"/.test(home));
  check(
    'the manifest link is not credentialed (breaks on static hosts)',
    !/<link rel="manifest"[^>]*use-credentials/.test(home)
  );
}

// 5 — Structured data: absolute images + a publisher logo.
console.log('\nstructured data');
{
  const relativeImages = [];
  const publishersWithoutLogo = [];
  let sawOrganizationLogo = false;

  for (const page of pages) {
    for (const block of jsonLdOf(read(page.file))) {
      for (const node of nodes(block)) {
        for (const key of ['image', 'url', 'logo', 'contentUrl']) {
          const value = node[key];
          const urls = (Array.isArray(value) ? value : [value]).filter((v) => typeof v === 'string');
          for (const url of urls) {
            if (url.startsWith('/')) relativeImages.push(`${page.route} ${key}=${url}`);
          }
        }
        if (node['@type'] === 'Organization' && node.logo) sawOrganizationLogo = true;
      }
      // A NewsArticle publisher must carry a logo (inline or via @id reference).
      for (const node of nodes(block)) {
        if (node['@type'] !== 'NewsArticle') continue;
        const publisher = node.publisher;
        if (!publisher) publishersWithoutLogo.push(`${page.route} (no publisher)`);
        else if (!publisher.logo && !publisher['@id']) publishersWithoutLogo.push(page.route);
      }
    }
  }

  check('no relative URLs in JSON-LD', relativeImages.length === 0, relativeImages.join(', '));
  check('an Organization node declares a logo', sawOrganizationLogo);
  check(
    'every NewsArticle has a publisher with a logo',
    publishersWithoutLogo.length === 0,
    publishersWithoutLogo.join(', ')
  );
}

// 6 — Feed freshness. A channel date that never moves teaches readers to stop polling.
console.log('\nfeed');
{
  const rss = read(path.join(OUT, 'rss.xml'));
  const lastBuild = new Date(attr(rss, /<lastBuildDate>([^<]+)<\/lastBuildDate>/));
  const pubDates = [...rss.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) => new Date(m[1]));
  const newestItem = pubDates.slice(1).reduce((a, b) => (b > a ? b : a), pubDates[1] || new Date(0));

  check('lastBuildDate parses', !Number.isNaN(lastBuild.valueOf()));
  check(
    'lastBuildDate tracks the newest item, not a hardcoded date',
    Math.abs(lastBuild - newestItem) < 24 * 3600 * 1000,
    `channel=${lastBuild.toUTCString()} newest item=${newestItem.toUTCString()}`
  );
  check('lastBuildDate is not in the future', lastBuild <= new Date(Date.now() + 60_000));

  const feedLinks = [...rss.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1]);
  const badLinks = feedLinks.filter((u) => u.includes('/posts/') && !u.endsWith('/'));
  check('feed item links use the canonical trailing-slash form', badLinks.length === 0, badLinks.join(', '));
}

// 7 — lastmod honesty. Evergreen pages must not claim to change every deploy.
console.log('\nsitemap lastmod');
{
  const entries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map(
    (m) => ({ route: toRoute(m[1]), lastmod: new Date(m[2]) })
  );
  check('every sitemap entry has a lastmod', entries.length === sitemapUrls.length);

  const evergreen = ['/about/', '/contact/', '/privacy-policy/', '/terms-of-service/'];
  const freshlyStamped = entries.filter(
    (e) => evergreen.includes(e.route) && Date.now() - e.lastmod < 24 * 3600 * 1000
  );
  check(
    'evergreen pages do not report a build-time lastmod',
    freshlyStamped.length === 0,
    `${freshlyStamped.map((e) => e.route).join(', ')} — bump lib/page-revisions.mjs instead of stamping now()`
  );

  const future = entries.filter((e) => e.lastmod > new Date(Date.now() + 24 * 3600 * 1000));
  check('no lastmod is in the future', future.length === 0, future.map((e) => e.route).join(', '));
}

// 8 — Thin-content policy for keyword-generated topic pages.
console.log('\nthin content');
{
  const topicPages = pages.filter((p) => /^\/topics\/[^/]+\/$/.test(p.route));
  const indexableTopics = topicPages.filter((p) => !/noindex/.test(robotsOf(read(p.file))));
  const sitemapTopics = new Set(sitemapUrls.map(toRoute).filter((p) => /^\/topics\/./.test(p)));

  // A topic page is only allowed in the index once it holds several posts.
  const thinButIndexable = indexableTopics.filter((p) => {
    const html = read(p.file);
    const count = (html.match(/\/posts\/[^"']+\/"/g) || []).length;
    return count < 3;
  });
  check(
    'no one-post topic page is indexable',
    thinButIndexable.length === 0,
    thinButIndexable.map((p) => p.route).join(', ')
  );

  const noindexedInSitemap = topicPages
    .filter((p) => /noindex/.test(robotsOf(read(p.file))))
    .filter((p) => sitemapTopics.has(p.route));
  check(
    'no noindex topic page is advertised in the sitemap',
    noindexedInSitemap.length === 0,
    noindexedInSitemap.map((p) => p.route).join(', ')
  );

  const home = read(path.join(OUT, 'index.html'));
  check('the homepage shows no empty "0 briefings" silo card', !/>0 briefings</.test(home));
}

// 9 — robots.txt must point at the sitemap.
console.log('\nrobots.txt');
{
  const robots = read(path.join(OUT, 'robots.txt'));
  check('declares a sitemap', /^Sitemap:\s*https?:\/\//m.test(robots));
  check('does not disallow the whole site', !/^Disallow:\s*\/\s*$/m.test(robots));
}

console.log(
  `\n${checks - failures}/${checks} checks passed${failures ? ` — ${failures} FAILED` : ''}\n`
);
process.exit(failures > 0 ? 1 : 0);
