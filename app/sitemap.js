import { pageRevision } from '../lib/page-revisions.mjs';
import { getAllPosts, getAllTopics, getPostsByTopic } from '../lib/posts';
import { absoluteUrl } from '../lib/seo.mjs';
import { SILOS } from '../lib/silos.mjs';
import siteConfig from '../site.config.mjs';

/**
 * lastmod policy
 * --------------
 * Every URL below reports a date derived from CONTENT, never from build time.
 * The pipeline deploys ~5x/day; stamping `new Date()` on evergreen pages made
 * every static route look freshly edited on every deploy, which is exactly how
 * you teach Google to ignore your lastmod signal entirely.
 *
 *  - posts        : the post's own publish date
 *  - hubs/indexes : the newest post they actually contain
 *  - legal/about  : a hand-declared revision date in lib/page-revisions.mjs,
 *                   bumped in the same commit that edits the page
 *
 * File mtime is deliberately NOT used: CI checks the repo out fresh on every
 * run, so every mtime would be the build timestamp — the same fake freshness in
 * a different costume.
 */

function postDate(post) {
  return new Date(`${post.date}T00:00:00Z`);
}

export default function sitemap() {
  const posts = getAllPosts();
  const topics = getAllTopics();
  const newest = posts[0] ? postDate(posts[0]) : new Date(0);
  const oldest = posts.length > 0 ? postDate(posts[posts.length - 1]) : newest;

  // Static pages change when their content changes, not when the pipeline runs.
  const staticMod = (route) => pageRevision(route, oldest);

  const staticRoutes = [
    { path: '/', priority: 1.0, changeFrequency: 'hourly', lastModified: newest },
    { path: '/archive', priority: 0.8, changeFrequency: 'daily', lastModified: newest },
    { path: '/topics', priority: 0.6, changeFrequency: 'weekly', lastModified: newest },
    {
      path: '/about',
      priority: 0.5,
      changeFrequency: 'yearly',
      lastModified: staticMod('/about'),
    },
    {
      path: '/contact',
      priority: 0.3,
      changeFrequency: 'yearly',
      lastModified: staticMod('/contact'),
    },
    {
      path: '/privacy-policy',
      priority: 0.3,
      changeFrequency: 'yearly',
      lastModified: staticMod('/privacy-policy'),
    },
    {
      path: '/terms-of-service',
      priority: 0.3,
      changeFrequency: 'yearly',
      lastModified: staticMod('/terms-of-service'),
    },
  ];

  const entries = [
    ...staticRoutes.map((route) => ({
      // absoluteUrl() applies the trailingSlash:true form, so sitemap URLs match
      // the canonical tags exactly instead of 301-redirecting.
      url: absoluteUrl(route.path),
      lastModified: route.lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    // Category hubs are primary landing pages — high priority.
    ...SILOS
      .map((silo) => ({
        silo,
        inSilo: posts.filter((post) => post.silo.slug === silo.slug),
      }))
      .filter(({ inSilo }) => inSilo.length >= siteConfig.categoryIndexThreshold)
      .map(({ silo, inSilo }) => ({
        url: absoluteUrl(`/category/${silo.slug}`),
        lastModified: postDate(inSilo[0]),
        changeFrequency: 'daily',
        priority: 0.85,
      })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/posts/${post.slug}`),
      lastModified: postDate(post),
      changeFrequency: 'weekly',
      priority: 0.9,
    })),
    // Only topics that clear the thin-content threshold are indexable, and a
    // noindex URL has no business being advertised in the sitemap.
    ...topics
      .filter((topic) => topic.count >= siteConfig.topicIndexThreshold)
      .map((topic) => {
        const topicPosts = getPostsByTopic(topic.slug);
        return {
          url: absoluteUrl(`/topics/${topic.slug}`),
          lastModified: topicPosts[0] ? postDate(topicPosts[0]) : oldest,
          changeFrequency: 'weekly',
          priority: 0.6,
        };
      }),
  ];

  return entries;
}
