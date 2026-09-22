import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import { getAllPosts, getAllTopics } from '../../lib/posts';
import { isTopicIndexable } from '../../lib/seo.mjs';

export const metadata = {
  title: 'Topics',
  description:
    'Browse every TechWire topic cluster, from artificial intelligence and semiconductors to open source, cybersecurity and the business of technology.',
  alternates: { canonical: '/topics/' },
};

export default function TopicsPage() {
  const allTopics = getAllTopics();
  const posts = getAllPosts();
  // Established clusters lead; emerging (still noindex) ones are listed after,
  // so the index stays useful to readers without promoting thin pages.
  const topics = allTopics.filter(isTopicIndexable);
  const emerging = allTopics.filter((topic) => !isTopicIndexable(topic));

  return (
    <div className="container page">
      <div className="layout">
        <div>
          <div className="page-head">
            <p className="eyebrow">Index</p>
            <h1>Topics</h1>
            <p>
              {allTopics.length} topic clusters across {posts.length} briefings.
            </p>
          </div>

          {allTopics.length === 0 ? (
            <div className="empty-state">
              <p>Topics are generated from article keywords. None have been published yet.</p>
            </div>
          ) : (
            <>
              {topics.length > 0 && (
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

              {emerging.length > 0 && (
                <section style={{ marginTop: 32 }}>
                  <h2>Emerging topics</h2>
                  <p>Clusters still building toward a full briefing set.</p>
                  <ul className="tag-list">
                    {emerging.map((topic) => (
                      <li key={topic.slug}>
                        <Link href={`/topics/${topic.slug}`} className="tag">
                          {topic.name} <span className="tag__count">{topic.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
        <Sidebar latest={posts.slice(0, 6)} topics={allTopics.slice(0, 12)} />
      </div>
    </div>
  );
}
