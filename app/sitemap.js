import { getAllPosts, getAllTopics } from '../lib/posts';
import siteConfig from '../site.config.mjs';

/** Static sitemap.xml generated at build time from the markdown corpus. */
export default function sitemap() {
  const posts = getAllPosts();
  const topics = getAllTopics();
  const now = new Date();
  const newest = posts[0] ? new Date(`${posts[0].date}T00:00:00Z`) : now;

  const staticRoutes = [
    { path: '/', priority: 1.0, changeFrequency: 'hourly', lastModified: newest },
    { path: '/archive', priority: 0.8, changeFrequency: 'daily', lastModified: newest },
    { path: '/topics', priority: 0.6, changeFrequency: 'weekly', lastModified: newest },
    { path: '/about', priority: 0.5, changeFrequency: 'yearly', lastModified: now },
    { path: '/contact', priority: 0.3, changeFrequency: 'yearly', lastModified: now },
    { path: '/privacy-policy', priority: 0.3, changeFrequency: 'yearly', lastModified: now },
    { path: '/terms-of-service', priority: 0.3, changeFrequency: 'yearly', lastModified: now },
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${siteConfig.url}${route.path}`,
      lastModified: route.lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...posts.map((post) => ({
      url: `${siteConfig.url}/posts/${post.slug}`,
      lastModified: new Date(`${post.date}T00:00:00Z`),
      changeFrequency: 'weekly',
      priority: 0.9,
    })),
    ...topics.map((topic) => ({
      url: `${siteConfig.url}/topics/${topic.slug}`,
      lastModified: newest,
      changeFrequency: 'weekly',
      priority: 0.6,
    })),
  ];
}
