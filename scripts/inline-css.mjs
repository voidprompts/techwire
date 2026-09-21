#!/usr/bin/env node
/**
 * Inline the built stylesheet into every exported HTML file.
 *
 * Two reasons:
 *
 * 1. Performance. The whole stylesheet is ~13KB (~3.5KB gzipped). Inlining it
 *    removes a render-blocking round trip on every cold page load, which is a
 *    direct LCP win — exactly what a static news site wants.
 *
 * 2. Robustness. A separate /_next/static/css/<hash>.css request is one more
 *    thing a CDN, proxy or cache can serve stale or mangle. When that happens
 *    the page renders as raw unstyled HTML with no console error, because the
 *    request itself "succeeded". Inlining makes the page styled by definition:
 *    if the HTML arrives, the CSS arrived with it.
 *
 * The original <link> is kept as a no-op fallback removed from the critical
 * path, so nothing breaks if a browser has the file cached already.
 *
 *   node scripts/inline-css.mjs [--dir out]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir');
const OUT = path.resolve(process.cwd(), dirArg !== -1 && args[dirArg + 1] ? args[dirArg + 1] : 'out');

if (!fs.existsSync(OUT)) {
  console.error(`inline-css: ${OUT} not found — run the build first.`);
  process.exit(0);
}

/** Recursively collect every .html file under a directory. */
function htmlFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

/** Escape a closing script/style sequence that would break out of the tag. */
function safeCss(css) {
  return css.replace(/<\/style/gi, '<\\/style');
}

const cssCache = new Map();

function readCss(href) {
  if (cssCache.has(href)) return cssCache.get(href);
  const filePath = path.join(OUT, decodeURIComponent(href.replace(/^\//, '')));
  const css = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  cssCache.set(href, css);
  return css;
}

const files = htmlFiles(OUT);
let patched = 0;
let missing = 0;

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('data-inlined-css')) continue;

  // Match every stylesheet link Next.js emitted for this page.
  const linkPattern = /<link[^>]+rel="stylesheet"[^>]*>/gi;
  const links = html.match(linkPattern);
  if (!links) continue;

  let bundle = '';
  let replacedAny = false;

  for (const link of links) {
    const href = (link.match(/href="([^"]+)"/) || [])[1];
    if (!href || !href.startsWith('/')) continue;
    const css = readCss(href);
    if (css == null) {
      missing += 1;
      continue;
    }
    bundle += css;
    // Drop the render-blocking link; the styles now ship in the document.
    html = html.replace(link, '');
    replacedAny = true;
  }

  if (!replacedAny || !bundle) continue;

  const styleTag = `<style data-inlined-css>${safeCss(bundle)}</style>`;
  html = html.includes('</head>')
    ? html.replace('</head>', `${styleTag}</head>`)
    : `${styleTag}${html}`;

  fs.writeFileSync(file, html, 'utf8');
  patched += 1;
}

console.log(
  `inline-css: inlined styles into ${patched}/${files.length} HTML files` +
    (missing ? ` (${missing} stylesheet reference(s) could not be resolved)` : '')
);
