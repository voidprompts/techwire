import { getAllPosts } from '../../lib/posts';
import { absoluteUrl, assetUrl } from '../../lib/seo.mjs';
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
  const allPosts = getAllPosts();
  const posts = allPosts.slice(0, 30);

  /**
   * lastBuildDate must track the newest CONTENT, not the newest build.
   *
   * It was previously derived from posts[0].date, which is correct in spirit
   * but broke whenever the newest file on disk carried an older date than a
   * future-dated post — the feed then advertised a stale channel date and
   * readers stopped polling. Take the true maximum publish date, and never let
   * it run ahead of "now" (a future-dated post must not push the channel into
   * the future, which some aggregators reject outright).
   */
  const now = new Date();
  const newest = allPosts.reduce((max, post) => {
    const date = new Date(`${post.date}T00:00:00Z`);
    return Number.isNaN(date.valueOf()) || date <= max ? max : date;
  }, new Date(0));
  const lastBuildDate = newest.valueOf() === 0 || newest > now ? now : newest;

  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/posts/${post.slug}`);
      const image = post.image ? assetUrl(post.image) : '';
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(post.description || post.excerpt)}</description>
      <pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>
${image ? `      <enclosure url="${escapeXml(image)}" type="image/jpeg" length="0" />\n` : ''}${post.keywords
        .map((k) => `      <category>${escapeXml(k)}</category>`)
        .join('\n')}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.name)}</title>
    <link>${escapeXml(absoluteUrl('/'))}</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <pubDate>${lastBuildDate.toUTCString()}</pubDate>
    <image>
      <url>${escapeXml(assetUrl(siteConfig.logo.url))}</url>
      <title>${escapeXml(siteConfig.name)}</title>
      <link>${escapeXml(absoluteUrl('/'))}</link>
    </image>
    <atom:link href="${escapeXml(assetUrl('/rss.xml'))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
