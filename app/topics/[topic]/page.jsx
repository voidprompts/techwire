import { notFound } from 'next/navigation';
import PostCard from '../../../components/PostCard';
import Sidebar from '../../../components/Sidebar';
import AdUnit from '../../../components/AdUnit';
import { getAllPosts, getAllTopics, getPostsByTopic } from '../../../lib/posts';

export function generateStaticParams() {
  return getAllTopics().map((topic) => ({ topic: topic.slug }));
}

export function generateMetadata({ params }) {
  const topic = getAllTopics().find((t) => t.slug === params.topic);
  if (!topic) return { title: 'Topic not found' };
  return {
    title: `${topic.name} news and analysis`,
    description: `In-depth TechWire briefings covering ${topic.name}. ${topic.count} articles and counting.`,
    alternates: { canonical: `/topics/${topic.slug}` },
  };
}

export default function TopicPage({ params }) {
  const topic = getAllTopics().find((t) => t.slug === params.topic);
  if (!topic) notFound();

  const posts = getPostsByTopic(topic.slug);

  return (
    <div className="container page">
      <div className="layout">
        <div>
          <div className="page-head">
            <p className="eyebrow">Topic</p>
            <h1>{topic.name}</h1>
            <p>{posts.length} {posts.length === 1 ? 'briefing' : 'briefings'} analysing {topic.name}.</p>
          </div>
          <AdUnit variant="below-title" />
          <div className="card-grid">
            {posts.map((post, index) => (
              <PostCard key={post.slug} post={post} priority={index === 0} />
            ))}
          </div>
        </div>
        <Sidebar latest={getAllPosts().slice(0, 6)} topics={getAllTopics().slice(0, 12)} />
      </div>
    </div>
  );
}
