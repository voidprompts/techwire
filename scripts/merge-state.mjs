#!/usr/bin/env node
/**
 * Conflict resolver for content/.scraper-state.json.
 *
 * The state file is the scraper's memory of URLs it has already judged. Every
 * run rewrites it, so two runs that touch the same branch (a schedule racing a
 * dispatch, or a re-run replaying onto a tip that already moved) always collide
 * on this one file — and a rebase conflict fails the job *after* the AI work is
 * done, throwing the whole run away.
 *
 * The file is semantically a SET, so a conflict has an obvious correct answer:
 * keep the union of both sides. This reads the conflicting stages straight out
 * of the git index and writes that union back.
 *
 * Usage (inside a conflicted rebase/merge):
 *   node scripts/merge-state.mjs [path]
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const FILE = process.argv[2] || 'content/.scraper-state.json';
const MAX_URLS = 4000;

/** Read one merge stage (1=base, 2=ours, 3=theirs) from the index. */
function readStage(stage) {
  try {
    return execFileSync('git', ['show', `:${stage}:${FILE}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function parseUrls(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.urls) ? parsed.urls.filter((u) => typeof u === 'string') : [];
  } catch {
    // A conflicted working-tree copy may still contain <<<<<<< markers.
    return [];
  }
}

// Stage 2 = the side already on the branch, stage 3 = the commit being replayed.
// If the file is not conflicted, fall back to whatever is on disk.
const ours = readStage(2);
const theirs = readStage(3);
const fallback = ours === null && theirs === null && fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : null;

const urls = [...new Set([...parseUrls(ours), ...parseUrls(theirs), ...parseUrls(fallback)])].slice(-MAX_URLS);

fs.writeFileSync(FILE, `${JSON.stringify({ updatedAt: new Date().toISOString(), urls }, null, 2)}\n`, 'utf8');

console.log(
  `merge-state: unioned ${parseUrls(ours).length} + ${parseUrls(theirs).length} entries into ${urls.length} unique URL(s)`
);
