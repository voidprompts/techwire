import Link from 'next/link';
import AdUnit from './AdUnit';
import { formatDate } from '../lib/posts';

/**
 * Sticky desktop rail. Collapses to normal flow (and the sticky ad is hidden)
 * below the 1024px breakpoint via CSS.
 */
export default function Sidebar({ latest = [], topics = [], heading = 'Latest briefings' }) {
  // Keep the rail useful rather than repeating every one-off article tag.
  // Full topic navigation remains available on article pages and /topics/.
  const featuredTopics = topics.filter((topic) => topic.count >= 2).slice(0, 8);

  return (
    <aside className="sidebar">
      <div className="sidebar__sticky">
        {latest.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">{heading}</h2>
            <ul className="panel__list">
              {latest.map((post) => (
                <li key={post.slug}>
                  <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                </li>
              ))}
            </ul>
          </section>
        )}

        {featuredTopics.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">Popular topics</h2>
            <ul className="tag-list">
              {featuredTopics.map((topic) => (
                <li key={topic.slug}>
                  <Link href={`/topics/${topic.slug}`} className="tag">
                    {topic.name} <span className="tag__count">{topic.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sticky sidebar ad slot (desktop breakpoints only) */}
        <AdUnit variant="sidebar" className="ad-unit--desktop-only" />
      </div>
    </aside>
  );
}
