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
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Resolved from this file, not cwd — the store tests repoint CONTENT_ROOT at a
// temp dir, but the source-level regression guards must read the real repo.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

import { extractArticle } from './lib/extract.mjs';
import { collectCandidates } from './lib/sources.mjs';
import { findDuplicate, loadIndex, uniqueSlug, writePost } from './lib/store.mjs';
import { buildQuery, toAttribution, withUtm } from './lib/unsplash.mjs';
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

  console.log('\ncontent silos');
  {
    const { classifyPost, SILOS, getSilo } = await import('../lib/silos.mjs');
    await test('exposes exactly the five configured silos', () => {
      assert.equal(SILOS.length, 5);
      assert.deepEqual(SILOS.map((s2) => s2.slug), [
        'artificial-intelligence', 'gadgets-hardware', 'software-dev', 'cybersecurity', 'startups-business',
      ]);
      SILOS.forEach((s2) => {
        assert.ok(s2.emoji && s2.name && s2.shortName && s2.blurb && s2.description, `${s2.slug} incomplete`);
      });
    });
    await test('classifies representative stories into the right silo', () => {
      const cases = [
        [['llm', 'transformer'], 'A New Transformer Variant Cuts Memory Use', 'artificial-intelligence'],
        [['smartphone', 'battery'], 'New Flagship Phone Pushes Battery Life', 'gadgets-hardware'],
        [['kubernetes', 'devops'], 'Kubernetes Ships Major Release', 'software-dev'],
        [['ransomware', 'breach'], 'Ransomware Group Leaks Data', 'cybersecurity'],
        [['funding', 'series b'], 'Startup Raises 40M Series B', 'startups-business'],
      ];
      for (const [keywords, title, expected] of cases) {
        assert.equal(classifyPost({ keywords, title }).slug, expected, `${title} -> wrong silo`);
      }
    });
    await test('matches simple plurals', () => {
      assert.equal(classifyPost({ keywords: ['semiconductors', 'chips'], title: 'Chip Roundup' }).slug, 'gadgets-hardware');
    });
    await test('an explicit front-matter category overrides inference', () => {
      assert.equal(
        classifyPost({ category: 'cybersecurity', keywords: ['gpu', 'chip'], title: 'Chips' }).slug,
        'cybersecurity'
      );
    });
    await test('unmatched posts fall back rather than being orphaned', () => {
      const result = classifyPost({ keywords: [], title: 'Entirely Unrelated Headline' });
      assert.ok(result && result.slug, 'must always return a silo');
    });
    await test('getSilo rejects unknown slugs', () => {
      assert.equal(getSilo('not-a-silo'), null);
      assert.ok(getSilo('cybersecurity'));
    });
  }

  console.log('\nlayout / ad placement');
  {
    const { splitHtmlForMidAd } = await import('../lib/posts.js');
    await test('mid-article ad lands near the true midpoint', () => {
      const section = (n) => `<h2>S${n}</h2>` + '<p>'.concat('word '.repeat(60), '</p>').repeat(2);
      const html = [1, 2, 3, 4, 5, 6].map(section).join('');
      const [a, b] = splitHtmlForMidAd(html);
      const ratio = a.length / html.length;
      assert.ok(ratio > 0.35 && ratio < 0.65, `split at ${(ratio * 100).toFixed(0)}% is not mid-article`);
      assert.equal(a + b, html, 'split must be lossless');
    });
    await test('split never severs an element', () => {
      const html = '<h2>A</h2><p>one</p><h2>B</h2><p>two</p><h2>C</h2><p>three</p><h2>D</h2><p>four</p>';
      const [a, b] = splitHtmlForMidAd(html);
      const balanced = (t) => (t.match(/<p>/g) || []).length === (t.match(/<\/p>/g) || []).length;
      assert.ok(balanced(a) && balanced(b), 'paragraph tags must stay balanced across the split');
      assert.ok(b.startsWith('<h2'), 'second half should begin at a heading');
    });
    await test('very short articles get no mid-ad rather than a bad one', () => {
      const [, b] = splitHtmlForMidAd('<p>only one para</p>');
      assert.equal(b, '', 'should return an empty second half so no ad renders');
    });
  }

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
    await test('buildQuery caps at 3 concrete terms and dedupes overlaps', () => {
      assert.equal(buildQuery(['data center', 'server rack', 'cooling', 'extra', 'more']), 'data center server rack cooling');
      assert.equal(buildQuery(['GPU', 'gpu', 'GPU cluster']), 'gpu');
      assert.equal(buildQuery(['AI/ML', 'chips!']), 'ai ml chips');
      assert.equal(buildQuery([]), '');
    });
    await test('maps an API photo object onto attribution fields', () => {
      const attribution = toAttribution({
        id: 'abc123',
        alt_description: 'a server rack',
        urls: { raw: 'https://images.unsplash.com/photo-raw', regular: 'https://images.unsplash.com/photo-regular' },
        links: { download_location: 'https://api.unsplash.com/photos/abc123/download' },
        user: { name: 'Jane Doe', links: { html: 'https://unsplash.com/@janedoe' } },
      });
      assert.equal(attribution.creditName, 'Jane Doe');
      assert.equal(attribution.creditUrl, 'https://unsplash.com/@janedoe?utm_source=techwire&utm_medium=referral');
      assert.equal(attribution.downloadLocation, 'https://api.unsplash.com/photos/abc123/download');
      assert.equal(attribution.imageUrl, 'https://images.unsplash.com/photo-regular', 'must prefer urls.regular');
      assert.equal(attribution.isRaw, false);
    });
    await test('falls back to urls.raw when regular is absent', () => {
      const attribution = toAttribution({
        urls: { raw: 'https://images.unsplash.com/photo-raw' },
        user: { name: 'Jane Doe', links: { html: 'https://unsplash.com/@janedoe' } },
      });
      assert.equal(attribution.imageUrl, 'https://images.unsplash.com/photo-raw');
      assert.equal(attribution.isRaw, true, 'raw fallback must be flagged for sizing');
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

    // Regression guards for the "successful run, zero posts" incident.
    console.log('\npublish-path regressions');

    await test('the autopilot commit message never carries a CI-skip marker', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/scrape-and-publish.yml'),
        'utf8'
      );
      const commitLine = workflow
        .split('\n')
        .find((line) => line.includes('git commit -m'));
      assert.ok(commitLine, 'expected a git commit line in the workflow');
      // Cloudflare Pages and deploy.yml both honour these markers, so an
      // article committed with one would never reach the live site.
      assert.ok(
        !/\[\s*(skip[ -]ci|ci[ -]skip|cf-pages-skip)\s*\]/i.test(commitLine),
        'commit message must not contain a CI-skip marker — it blocks deployment'
      );
    });

    await test('new content is detected from posts, not the state file', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/scrape-and-publish.yml'),
        'utf8'
      );
      const detect = workflow.slice(
        workflow.indexOf('id: changes'),
        workflow.indexOf('- name: Commit and push')
      );
      assert.ok(
        detect.includes("git status --porcelain content/posts/"),
        'the changed flag must be driven by content/posts/'
      );
      assert.ok(
        !/if \[ -n "\$\(git status --porcelain content\/ /.test(detect),
        'the bookkeeping state file must not, by itself, mark the run as changed'
      );
    });

    await test('no retired Gemini 1.5 model id is configured anywhere', () => {
      for (const file of ['scripts/lib/ai.mjs', '.env.example']) {
        const contents = fs.readFileSync(path.join(repoRoot, file), 'utf8');
        const active = contents
          .split('\n')
          // Comments may legitimately mention the retired ids to explain them.
          .filter((line) => !/^\s*(#|\/\/|\*)/.test(line))
          .join('\n');
        assert.ok(
          !/gemini-1\.5-[a-z0-9.-]*/i.test(active),
          `${file} still references a retired Gemini 1.5 model id`
        );
      }
    });

    await test('a 404 from the model endpoint is fatal, not retried', () => {
      const ai = fs.readFileSync(path.join(repoRoot, 'scripts/lib/ai.mjs'), 'utf8');
      const geminiBlock = ai.slice(ai.indexOf('async function callGemini'), ai.indexOf('async function callGroq'));
      const guard = geminiBlock.match(/if \(\[([^\]]*)\]\.includes\(response\.status\)\) error\.fatal = true/);
      assert.ok(guard, 'expected a fatal-status guard in callGemini');
      assert.ok(guard[1].includes('404'), '404 must be fatal so a dead model id cannot silently burn a run');
    });

    await test('infrastructure failures do not blacklist the source URL', () => {
      const scrape = fs.readFileSync(path.join(repoRoot, 'scripts/scrape.mjs'), 'utf8');
      const catchBlock = scrape.slice(scrape.indexOf('} catch (error) {'), scrape.indexOf('saveState('));
      assert.ok(
        !/rejectedUrls\.push/.test(catchBlock),
        'a thrown error must not add the URL to the permanent rejected list'
      );
      assert.ok(/failures\.push/.test(catchBlock), 'failures should be tracked for retry instead');
    });

    await test('state-file conflicts resolve to the union of both sides', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'techwire-merge-'));
      const file = path.join(dir, 'state.json');

      // Outside a conflicted index the resolver must preserve, never truncate.
      fs.writeFileSync(
        file,
        JSON.stringify({ updatedAt: 'x', urls: ['https://a.com/1', 'https://a.com/2'] }, null, 2)
      );
      execFileSync(process.execPath, [path.join(repoRoot, 'scripts/merge-state.mjs'), file], {
        stdio: 'ignore',
      });
      assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).urls, [
        'https://a.com/1',
        'https://a.com/2',
      ]);

      // A half-written/conflicted file must not crash the resolver.
      fs.writeFileSync(file, '<<<<<<< HEAD\nnot json\n>>>>>>> other\n');
      execFileSync(process.execPath, [path.join(repoRoot, 'scripts/merge-state.mjs'), file], {
        stdio: 'ignore',
      });
      assert.ok(Array.isArray(JSON.parse(fs.readFileSync(file, 'utf8')).urls));

      fs.rmSync(dir, { recursive: true, force: true });
    });

    await test('the push step recovers from a state-file rebase conflict', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/scrape-and-publish.yml'),
        'utf8'
      );
      const push = workflow.slice(workflow.indexOf('- name: Commit and push'));
      assert.ok(/merge-state\.mjs/.test(push), 'push step must auto-resolve the state file');
      assert.ok(/rebase --continue/.test(push), 'and finish the rebase rather than aborting');
      assert.ok(
        /Unresolvable conflict/.test(push),
        'but still fail loudly on a conflict in any other path'
      );
    });

    await test('a run that publishes nothing after attempts exits non-zero', () => {
      const scrape = fs.readFileSync(path.join(repoRoot, 'scripts/scrape.mjs'), 'utf8');
      assert.ok(
        /attempts > 0 && published\.length === 0[\s\S]*process\.exitCode = 1/.test(scrape),
        'an empty publish after real attempts must fail the workflow, not report success'
      );
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
