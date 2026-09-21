import PostCard from '../../components/PostCard';
import Sidebar from '../../components/Sidebar';
import AdUnit from '../../components/AdUnit';
import { getAllPosts, getAllTopics } from '../../lib/posts';

export const metadata = {
  title: 'Archive',
  description: 'Every technology briefing published on TechWire, newest first.',
  alternates: { canonical: '/archive' },
};

export default function ArchivePage() {
  const posts = getAllPosts();
  const topics = getAllTopics().slice(0, 16);
  const midpoint = Math.ceil(posts.length / 2);

  return (
    <div className="container page">
      <div className="layout">
        <div>
          <div className="page-head">
            <p className="eyebrow">Archive</p>
            <h1>Every briefing we have published</h1>
            <p>{posts.length} analytical articles, indexed newest first.</p>
          </div>

          {posts.length === 0 ? (
            <div className="empty-state">
              <h2>The archive is empty</h2>
              <p>Articles appear here as soon as the automation pipeline publishes them.</p>
            </div>
          ) : (
            <>
              <div className="card-grid">
                {posts.slice(0, midpoint).map((post, index) => (
                  <PostCard key={post.slug} post={post} priority={index === 0} />
                ))}
              </div>
              {posts.length > 4 && <AdUnit variant="in-article" />}
              <div className="card-grid">
                {posts.slice(midpoint).map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            </>
          )}
        </div>
        <Sidebar latest={posts.slice(0, 6)} topics={topics} />
      </div>
    </div>
  );
}
