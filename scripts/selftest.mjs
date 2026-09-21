#!/usr/bin/env node
/**
 * Offline self-test for the scraper pipeline.
 *
 * Spins up a local fixture server that imitates an RSS feed, a Hacker News
 * API response, a Reddit listing and a real article page, then runs the
 * genuine collector / extractor / dedupe / writer code against it.
 *
 * No network access and no AI key required.
 *
 *   node scripts/selftest.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { extractArticle } from './lib/extract.mjs';
import { collectCandidates } from './lib/sources.mjs';
import { findDuplicate, loadIndex, uniqueSlug, writePost } from './lib/store.mjs';
import { toAttribution, withUtm } from './lib/unsplash.mjs';
import { normalizeUrl, similarity, slugify, stripHtml } from './lib/utils.mjs';

const NOW = new Date().toUTCString();
const ISO = new Date().toISOString();

const ARTICLE_HTML = `<!doctype html>
<html><head>
<title>Quantum Error Correction Hits a Practical Milestone | Fixture News</title>
<meta property="og:title" content="Quantum Error Correction Hits a Practical Milestone">
<meta property="og:description" content="Researchers demonstrated a logical qubit that outperforms its physical components.">
<meta property="og:image" content="/media/hero.jpg">
<meta property="og:site_name" content="Fixture News">
<meta property="article:published_time" content="${ISO}">
</head>
<body>
<nav class="site-nav"><a href="/">Home</a><a href="/tech">Tech</a></nav>
<div class="sidebar promo"><p>Subscribe to our newsletter for daily updates delivered to your inbox today.</p></div>
<article class="post-content">
<p>Researchers reported this week that a quantum processor sustained a logical qubit whose error rate fell below that of the individual physical qubits composing it, a threshold the field has pursued for two decades.</p>
<p>The demonstration matters because quantum error correction has always carried a circular problem: the machinery required to detect and fix errors introduces errors of its own, and until recently that overhead exceeded the benefit it delivered in practice.</p>
<h2>How the correction scheme works</h2>
<p>The team encoded a single logical qubit across a lattice of physical qubits arranged in a surface code, a topology in which errors manifest as detectable parity violations along the lattice rather than as silent corruption of stored information.</p>
<p>Crucially, increasing the size of the lattice reduced the logical error rate rather than increasing it, which is the specific behaviour that distinguishes a working error correction scheme from an expensive one that merely appears to function at small scale.</p>
<p>Scaling in that direction requires control electronics that grow with qubit count, and the researchers acknowledged that wiring density remains an unsolved engineering constraint at the scale required for commercially meaningful computation.</p>
<h2>What remains unproven</h2>
<p>The result covers a single logical qubit held in memory. Performing useful computation requires many logical qubits interacting through logical gate operations, and the error budget for those operations is considerably tighter than for storage alone.</p>
<p>Independent replication has not yet occurred, and the team described the work as an engineering milestone rather than evidence that commercially relevant quantum advantage is imminent for any specific application.</p>
<p>Advertisement</p>
<p>Follow us on social media for more coverage.</p>
</article>
<footer><p>Copyright Fixture News. All rights reserved worldwide.</p></footer>
</body></html>`;

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>Fixture News</title>
  <item>
    <title>Quantum Error Correction Hits a Practical Milestone</title>
    <link>__BASE__/articles/quantum-error-correction?utm_source=rss&amp;utm_medium=feed</link>
    <description>Researchers demonstrated a logical qubit that &lt;b&gt;outperforms&lt;/b&gt; its physical components.</description>
    <pubDate>${NOW}</pubDate>
    <media:content url="__BASE__/media/hero.jpg" type="image/jpeg"/>
  </item>
  <item>
    <title>Best Laptop Deals: Save 40% Off Today</title>
    <link>__BASE__/articles/deals</link>
    <pubDate>${NOW}</pubDate>
  </item>
  <item>
    <title>Stale Story From Last Month</title>
    <link>__BASE__/articles/stale</link>
    <pubDate>${new Date(Date.now() - 40 * 864e5).toUTCString()}</pubDate>
  </item>
</channel>
</rss>`;

const ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Fixture Atom</title>
  <entry>
    <title>Compiler Toolchains Converge on a Shared IR</title>
    <link href="__BASE__/articles/compiler-ir"/>
    <published>${ISO}</published>
    <summary>A shared intermediate representation is reshaping accelerator support.</summary>
  </entry>
</feed>`;

function hnJson(base) {
  return JSON.stringify({
    hits: [
      { title: 'A Deep Dive Into Memory Bandwidth Limits', url: `${base}/articles/memory-bandwidth`, points: 340, created_at: ISO },
      { title: 'Low Score Story', url: `${base}/articles/low`, points: 4, created_at: ISO },
      { title: 'Ask HN: What are you working on?', url: `${base}/articles/askhn`, points: 900, created_at: ISO },
      { title: 'No URL Story', points: 500, created_at: ISO },
    ],
  });
}

function redditJson(base) {
  return JSON.stringify({
    data: {
      children: [
        { data: { title: 'Regulators Open Inquiry Into Cloud Pricing', url: `${base}/articles/cloud-pricing`, score: 2400, created_utc: Date.now() / 1000, is_self: false, over_18: false, thumbnail: `${base}/media/thumb.jpg` } },
        { data: { title: 'Self post discussion thread', selftext: 'hello', url: `${base}/r/technology/x`, score: 5000, created_utc: Date.now() / 1000, is_self: true, over_18: false } },
        { data: { title: 'Unpopular link', url: `${base}/articles/unpopular`, score: 12, created_utc: Date.now() / 1000, is_self: false, over_18: false } },
      ],
    },
  });
}

function startFixtureServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const base = `http://127.0.0.1:${server.address().port}`;
      const url = req.url.split('?')[0];

      const send = (type, body) => {
        res.writeHead(200, { 'content-type': type });
        res.end(body.replaceAll('__BASE__', base));
      };

      if (url === '/feed.rss') return send('application/rss+xml', RSS_XML);
      if (url === '/feed.atom') return send('application/atom+xml', ATOM_XML);
      if (url === '/hn.json') return send('application/json', hnJson(base));
      if (url === '/reddit.json') return send('application/json', redditJson(base));
      if (url.startsWith('/articles/')) return send('text/html', ARTICLE_HTML);
      if (url === '/broken') {
        res.writeHead(404); return res.end('nope');
      }
      res.writeHead(404);
      res.end('not found');
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}\n      ${error.message}`);
  }
}

async function main() {
  const server = await startFixtureServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'techwire-'));
  fs.mkdirSync(path.join(tmp, 'content', 'posts'), { recursive: true });
  // Redirect the store at a temp corpus so the test can never write into the real repo.
  const previousRoot = process.env.CONTENT_ROOT;
  process.env.CONTENT_ROOT = tmp;

  console.log('\nTechWire pipeline self-test\n');

  console.log('utils');
  await test('slugify produces clean, bounded slugs', () => {
    assert.equal(slugify('Why AI Inference Costs Are Rewriting Cloud Economics!'), 'why-ai-inference-costs-are-rewriting-cloud-economics');
    assert.ok(slugify('x'.repeat(200)).length <= 70);
    assert.equal(slugify('Café & Crème'), 'cafe-and-creme');
  });

  await test('normalizeUrl strips tracking params and www', () => {
    assert.equal(normalizeUrl('https://www.example.com/a/b?utm_source=rss&id=7#frag'), 'https://example.com/a/b?id=7');
  });

  await test('similarity detects restatements of the same headline', () => {
    assert.ok(similarity('Apple unveils new M5 chip for MacBook Pro', 'Apple announces M5 chip in new MacBook Pro') > 0.5);
    assert.ok(similarity('Apple unveils new M5 chip', 'EU opens antitrust probe into ticketing') < 0.2);
  });

  await test('stripHtml removes markup and decodes entities', () => {
    assert.equal(stripHtml('<p>Tom &amp; Jerry&#39;s <b>show</b></p>'), "Tom & Jerry's show");
  });

  console.log('\nsources');
  const sources = [
    { name: 'Fixture RSS', type: 'rss', url: `${base}/feed.rss` },
    { name: 'Fixture Atom', type: 'rss', url: `${base}/feed.atom` },
    { name: 'Fixture HN', type: 'hackernews', url: `${base}/hn.json`, minScore: 100 },
    { name: 'Fixture Reddit', type: 'reddit', url: `${base}/reddit.json`, minScore: 800 },
    { name: 'Dead Source', type: 'rss', url: `${base}/broken` },
  ];
  const candidates = await collectCandidates(sources);
  const titles = candidates.map((c) => c.title);

  await test('parses RSS 2.0 items', () => {
    assert.ok(titles.includes('Quantum Error Correction Hits a Practical Milestone'));
  });
  await test('parses Atom entries', () => {
    assert.ok(titles.includes('Compiler Toolchains Converge on a Shared IR'));
  });
  await test('parses Hacker News hits above the score threshold', () => {
    assert.ok(titles.includes('A Deep Dive Into Memory Bandwidth Limits'));
  });
  await test('parses Reddit listings above the score threshold', () => {
    assert.ok(titles.includes('Regulators Open Inquiry Into Cloud Pricing'));
  });
  await test('applies the title blocklist (deals, Ask HN)', () => {
    assert.ok(!titles.some((t) => /Best Laptop Deals/.test(t)));
    assert.ok(!titles.some((t) => /^Ask HN/.test(t)));
  });
  await test('drops low-score and self-post entries', () => {
    assert.ok(!titles.includes('Low Score Story'));
    assert.ok(!titles.includes('Unpopular link'));
    assert.ok(!titles.includes('Self post discussion thread'));
  });
  await test('drops items outside the freshness window', () => {
    assert.ok(!titles.includes('Stale Story From Last Month'));
  });
  await test('a failing source does not abort collection', () => {
    assert.ok(candidates.length >= 4);
  });
  await test('tracking params are normalized away in candidate URLs', () => {
    const quantum = candidates.find((c) => c.title.startsWith('Quantum'));
    assert.ok(!quantum.url.includes('utm_'), quantum.url);
  });

  console.log('\nextract');
  const article = await extractArticle(`${base}/articles/quantum-error-correction`);
  await test('extracts metadata from og tags', () => {
    assert.equal(article.title, 'Quantum Error Correction Hits a Practical Milestone');
    assert.equal(article.siteName, 'Fixture News');
    assert.equal(article.image, `${base}/media/hero.jpg`, 'og:image should be absolutised');
  });
  await test('extracts the main article body', () => {
    assert.ok(article.charCount > 900, `only ${article.charCount} chars`);
    assert.ok(article.text.includes('surface code'));
  });
  await test('excludes navigation, promos and boilerplate', () => {
    assert.ok(!article.text.includes('Subscribe to our newsletter'), 'promo leaked');
    assert.ok(!article.text.includes('Follow us on social media'), 'boilerplate leaked');
    assert.ok(!article.text.includes('Advertisement'), 'ad label leaked');
    assert.ok(!article.text.includes('All rights reserved'), 'footer leaked');
  });
  await test('returns null for an unreachable page', async () => {
    const missing = await extractArticle(`${base}/broken`);
    assert.equal(missing, null);
  });

  console.log('\nstore (dedupe + write)');
  try {
    const emptyIndex = loadIndex();
    await test('loads an empty corpus without throwing', () => {
      assert.equal(emptyIndex.posts.length, 0);
    });

    const slug = uniqueSlug(emptyIndex, 'Quantum Error Correction Hits a Milestone', `${base}/articles/quantum-error-correction`);
    const written = writePost({
      slug,
      title: 'Quantum Error Correction Hits a Milestone',
      description: 'A logical qubit outperformed its physical components, and the "threshold" finally fell.',
      keywords: ['quantum computing', 'error correction'],
      image: `${base}/media/hero.jpg`,
      sourceUrl: `${base}/articles/quantum-error-correction`,
      sourceName: 'Fixture News',
      body: '## How it works\n\nBody copy goes here.',
      date: '2025-09-20',
    });

    await test('writes a markdown file with valid front-matter', async () => {
      const raw = fs.readFileSync(path.join(tmp, written), 'utf8');
      const { default: matter } = await import('gray-matter');
      const { data, content } = matter(raw);
      assert.equal(data.title, 'Quantum Error Correction Hits a Milestone');
      assert.equal(data.date, '2025-09-20');
      assert.deepEqual(data.keywords, ['quantum computing', 'error correction']);
      assert.equal(data.source_url, `${base}/articles/quantum-error-correction`);
      assert.ok(data.description.includes('"threshold"'), 'quotes must survive YAML escaping');
      assert.ok(content.includes('## How it works'));
    });

    const index = loadIndex();
    await test('re-reads the written post into the index', () => {
      assert.equal(index.posts.length, 1);
    });
    await test('rejects an identical source URL', () => {
      const dup = findDuplicate(index, { title: 'Totally different headline', url: `${base}/articles/quantum-error-correction?utm_source=x` });
      assert.ok(dup, 'should have flagged the duplicate URL');
    });
    await test('rejects a near-identical title from another outlet', () => {
      const dup = findDuplicate(index, { title: 'Quantum Error Correction Hits Practical Milestone', url: 'https://other.example.com/story' });
      assert.ok(dup, 'should have flagged the similar title');
    });
    await test('accepts a genuinely new story', () => {
      const dup = findDuplicate(index, { title: 'EU Opens Antitrust Inquiry Into App Store Fees', url: 'https://other.example.com/eu' });
      assert.equal(dup, null);
    });
    await test('generates a collision-free slug when titles repeat', () => {
      const second = uniqueSlug(index, 'Quantum Error Correction Hits a Milestone', 'https://other.example.com/x');
      assert.notEqual(second, slug);
    });
    console.log('\nunsplash attribution');
    await test('appends utm params to a bare profile URL', () => {
      assert.equal(
        withUtm('https://unsplash.com/@janedoe'),
        'https://unsplash.com/@janedoe?utm_source=techwire&utm_medium=referral'
      );
    });
    await test('appends utm params to a URL that already has a query', () => {
      assert.equal(
        withUtm('https://unsplash.com/@jane?foo=1'),
        'https://unsplash.com/@jane?foo=1&utm_source=techwire&utm_medium=referral'
      );
    });
    await test('maps an API photo object onto attribution fields', () => {
      const attribution = toAttribution({
        id: 'abc123',
        alt_description: 'a server rack',
        urls: { raw: 'https://images.unsplash.com/photo-1' },
        links: { download_location: 'https://api.unsplash.com/photos/abc123/download' },
        user: { name: 'Jane Doe', links: { html: 'https://unsplash.com/@janedoe' } },
      });
      assert.equal(attribution.creditName, 'Jane Doe');
      assert.equal(attribution.creditUrl, 'https://unsplash.com/@janedoe?utm_source=techwire&utm_medium=referral');
      assert.equal(attribution.downloadLocation, 'https://api.unsplash.com/photos/abc123/download');
      assert.equal(attribution.rawUrl, 'https://images.unsplash.com/photo-1');
    });
    await test('returns null when the photo lacks attribution data', () => {
      assert.equal(toAttribution({ user: { name: 'Jane' } }), null, 'missing profile URL');
      assert.equal(toAttribution({ user: { links: { html: 'https://u.com/x' } } }), null, 'missing name');
      assert.equal(toAttribution({}), null, 'missing user');
    });

    await test('writes image_credit_* front-matter when a credit is supplied', async () => {
      const creditSlug = 'credited-story';
      const written = writePost({
        slug: creditSlug,
        title: 'A Credited Story',
        description: 'Has an Unsplash image.',
        keywords: ['tech'],
        image: '/images/thumbnails/credited-story.jpg',
        imageCreditName: 'Jane Doe',
        imageCreditUrl: 'https://unsplash.com/@janedoe?utm_source=techwire&utm_medium=referral',
        sourceUrl: 'https://example.com/credited',
        sourceName: 'Example',
        body: '## Heading\n\nBody.',
        date: '2025-09-21',
      });
      const { default: matter } = await import('gray-matter');
      const { data } = matter(fs.readFileSync(path.join(tmp, written), 'utf8'));
      assert.equal(data.image, '/images/thumbnails/credited-story.jpg');
      assert.equal(data.image_credit_name, 'Jane Doe');
      assert.ok(data.image_credit_url.includes('utm_source=techwire'));
      assert.ok(data.image_credit_url.includes('utm_medium=referral'));
    });

    await test('omits image_credit_* keys entirely when there is no credit', async () => {
      const written = writePost({
        slug: 'uncredited-story',
        title: 'An Uncredited Story',
        description: 'Uses the source OG image.',
        keywords: ['tech'],
        image: 'https://cdn.example.com/og.jpg',
        sourceUrl: 'https://example.com/uncredited',
        sourceName: 'Example',
        body: '## Heading\n\nBody.',
        date: '2025-09-21',
      });
      const raw = fs.readFileSync(path.join(tmp, written), 'utf8');
      assert.ok(!raw.includes('image_credit_name'), 'should not emit an empty credit key');
      assert.ok(!raw.includes('image_credit_url'));
    });
  } finally {
    if (previousRoot === undefined) delete process.env.CONTENT_ROOT;
    else process.env.CONTENT_ROOT = previousRoot;
    fs.rmSync(tmp, { recursive: true, force: true });
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
