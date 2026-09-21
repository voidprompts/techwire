import Link from 'next/link';
import PostCard from '../components/PostCard';
import Sidebar from '../components/Sidebar';
import AdUnit from '../components/AdUnit';
import { getAllPosts, getAllTopics } from '../lib/posts';
import siteConfig from '../site.config.mjs';

export const metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const posts = getAllPosts();
  const topics = getAllTopics().slice(0, 12);
  const [lead, ...rest] = posts;
  const feature = rest.slice(0, siteConfig.postsPerPage - 1);

  return (
    <div className="container page">
      <div className="layout">
        <div>
          <div className="page-head">
            <p className="eyebrow">Today on {siteConfig.name}</p>
            <h1>{siteConfig.tagline}</h1>
            <p>{siteConfig.descriptionLong}</p>
          </div>

          {posts.length === 0 ? (
            <div className="empty-state">
              <h2>No briefings published yet</h2>
              <p>
                Run <code>npm run scrape</code> locally, or wait for the scheduled GitHub Action to
                publish the first batch of articles.
              </p>
            </div>
          ) : (
            <>
              <div className="card-grid">
                <PostCard post={lead} variant="lead" priority />
              </div>

              {/* Responsive leaderboard between the lead story and the river */}
              <AdUnit variant="below-title" label="Advertisement" />

              <div className="card-grid">
                {feature.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>

              {posts.length > siteConfig.postsPerPage && (
                <div className="pagination">
                  <Link href="/archive">Browse the full archive →</Link>
                </div>
              )}
            </>
          )}
        </div>

        <Sidebar latest={posts.slice(0, 6)} topics={topics} />
      </div>
    </div>
  );
}
