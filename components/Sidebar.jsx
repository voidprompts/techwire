import Link from 'next/link';
import AdUnit from './AdUnit';
import { formatDate } from '../lib/posts';

/**
 * Sticky desktop rail. Collapses to normal flow (and the sticky ad is hidden)
 * below the 1024px breakpoint via CSS.
 */
export default function Sidebar({ latest = [], topics = [], heading = 'Latest briefings' }) {
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

        {topics.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">Topics</h2>
            <ul className="tag-list">
              {topics.map((topic) => (
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
