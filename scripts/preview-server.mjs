#!/usr/bin/env node
/**
 * Minimal static file server for previewing the exported site.
 *
 * Why not `npx serve`? It emits `Content-Disposition: inline; filename="..."`
 * on every asset. Behind a proxy that header can make browsers treat a
 * stylesheet as a file to download rather than one to apply, so the page
 * renders completely unstyled. This server sets only the headers a static
 * host actually needs.
 *
 *   node scripts/preview-server.mjs [--port 3000] [--dir out]
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(getArg('--port', process.env.PORT || 3000));
const ROOT = path.resolve(process.cwd(), getArg('--dir', 'out'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

/** Resolve a URL path to a file inside ROOT, or null if it escapes or is missing. */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const target = path.resolve(ROOT, `.${path.posix.normalize(decoded)}`);

  // Directory traversal guard.
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;

  const candidates = [target];
  if (!path.extname(target)) {
    candidates.push(path.join(target, 'index.html'), `${target}.html`);
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const filePath = resolveFile(req.url || '/');

  // Log every request so preview problems can be traced to what the browser
  // actually asked for, rather than what we assume it asked for.
  const ua = (req.headers['user-agent'] || '').slice(0, 60);
  console.log(
    `${req.method} ${req.url} -> ${filePath ? path.relative(ROOT, filePath) : '404'} | ua="${ua}"`
  );

  if (!filePath) {
    const notFound = path.join(ROOT, '404.html');
    const body = fs.existsSync(notFound) ? fs.readFileSync(notFound) : Buffer.from('404 Not Found');
    res.writeHead(404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length,
    });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }

  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Content-Length': body.length,
    // Never cache during preview so a rebuild is always reflected on reload.
    'Cache-Control': 'no-store, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving ${ROOT} at http://0.0.0.0:${PORT}`);
});
