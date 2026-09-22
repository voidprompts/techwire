import { notFound } from 'next/navigation';
import PostCard from '../../../components/PostCard';
import Sidebar from '../../../components/Sidebar';
import AdUnit from '../../../components/AdUnit';
import { getAllPosts, getAllTopics, getPostsByTopic } from '../../../lib/posts';
import { absoluteUrl, isTopicIndexable, ogImages, twitterImages } from '../../../lib/seo.mjs';
import siteConfig from '../../../site.config.mjs';


export function generateStaticParams() {
  return getAllTopics().map((topic) => ({ topic: topic.slug }));
}

export async function generateMetadata({ params }) {
  const { topic: topicSlug } = await params;
  const topic = getAllTopics().find((t) => t.slug === topicSlug);
  if (!topic) return { title: 'Topic not found', robots: { index: false, follow: false } };
  const indexable = isTopicIndexable(topic);
  return {
    title: `${topic.name} news and analysis`,
    // Aim for 120-160 chars so Google renders it verbatim instead of rewriting.
    description:
      `Original analysis of ${topic.name} from the TechWire desk: ${topic.count} in-depth ` +
      `${topic.count === 1 ? 'briefing' : 'briefings'} on what is changing, why it matters and what to watch next.`,
    alternates: { canonical: `/topics/${topic.slug}/` },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true, googleBot: { index: false, follow: true } },
    openGraph: {
      type: 'website',
      title: `${topic.name} — ${siteConfig.name}`,
      url: absoluteUrl(`/topics/${topic.slug}`),
      siteName: siteConfig.name,
      // Declaring openGraph at all replaces the layout's block wholesale, so
      // the default share card has to be repeated here or the page ships none.
      images: ogImages(),
    },
    twitter: { card: 'summary_large_image', images: twitterImages() },
  };
}

export default async function TopicPage({ params }) {
  const { topic: topicSlug } = await params;
  const topic = getAllTopics().find((t) => t.slug === topicSlug);
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
