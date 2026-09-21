import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import { getAllPosts, getAllTopics } from '../../lib/posts';

export const metadata = {
  title: 'Topics',
  description:
    'Browse every TechWire topic cluster, from artificial intelligence and semiconductors to open source, cybersecurity and the business of technology.',
  alternates: { canonical: '/topics' },
};

export default function TopicsPage() {
  const topics = getAllTopics();
  const posts = getAllPosts();

  return (
    <div className="container page">
      <div className="layout">
        <div>
          <div className="page-head">
            <p className="eyebrow">Index</p>
            <h1>Topics</h1>
            <p>{topics.length} topic clusters across {posts.length} briefings.</p>
          </div>

          {topics.length === 0 ? (
            <div className="empty-state">
              <p>Topics are generated from article keywords. None have been published yet.</p>
            </div>
          ) : (
            <ul className="tag-list">
              {topics.map((topic) => (
                <li key={topic.slug}>
                  <Link href={`/topics/${topic.slug}`} className="tag">
                    {topic.name} <span className="tag__count">{topic.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Sidebar latest={posts.slice(0, 6)} topics={topics.slice(0, 12)} />
      </div>
    </div>
  );
}
