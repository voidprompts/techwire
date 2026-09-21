import { getAllPosts } from '../../lib/posts';
import siteConfig from '../../site.config.mjs';

// Required for `output: 'export'` — emits a static /rss.xml file at build time.
export const dynamic = 'force-static';

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function GET() {
  const posts = getAllPosts().slice(0, 30);
  const updated = posts[0] ? new Date(`${posts[0].date}T00:00:00Z`) : new Date();

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${siteConfig.url}/posts/${post.slug}</link>
      <guid isPermaLink="true">${siteConfig.url}/posts/${post.slug}</guid>
      <description>${escapeXml(post.description || post.excerpt)}</description>
      <pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>
${post.keywords.map((k) => `      <category>${escapeXml(k)}</category>`).join('\n')}
    </item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.name)}</title>
    <link>${siteConfig.url}</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${siteConfig.url}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
