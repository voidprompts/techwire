import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostCard from '../../../components/PostCard';
import Sidebar from '../../../components/Sidebar';
import AdUnit from '../../../components/AdUnit';
import JsonLd from '../../../components/JsonLd';
import { getAllPosts, getAllTopics, getPostsBySilo } from '../../../lib/posts';
import { SILOS, getSilo } from '../../../lib/silos.mjs';
import siteConfig from '../../../site.config.mjs';

/** One static page per silo. */
export function generateStaticParams() {
  return SILOS.map((silo) => ({ silo: silo.slug }));
}

export function generateMetadata({ params }) {
  const silo = getSilo(params.silo);
  if (!silo) return { title: 'Category not found' };
  return {
    title: `${silo.name} news and analysis`,
    description: silo.description,
    alternates: { canonical: `/category/${silo.slug}` },
    openGraph: {
      type: 'website',
      title: `${silo.name} — ${siteConfig.name}`,
      description: silo.description,
      url: `/category/${silo.slug}`,
    },
  };
}

export default function CategoryPage({ params }) {
  const silo = getSilo(params.silo);
  if (!silo) notFound();

  const posts = getPostsBySilo(silo.slug);
  const [lead, ...rest] = posts;

  return (
    <div className="container page">
      <div className="layout">
        <div>
          <div className="page-head">
            <p className="eyebrow">
              <span aria-hidden="true">{silo.emoji}</span> Category
            </p>
            <h1>{silo.name}</h1>
            <p>{silo.description}</p>
          </div>

          {/* Sibling categories keep every silo one click away (internal linking) */}
          <nav className="silo-strip" aria-label="All categories">
            {SILOS.map((item) => (
              <Link
                key={item.slug}
                href={`/category/${item.slug}`}
                className="silo-chip"
                aria-current={item.slug === silo.slug ? 'page' : undefined}
              >
                <span aria-hidden="true">{item.emoji}</span> {item.shortName}
              </Link>
            ))}
          </nav>

          {posts.length === 0 ? (
            <div className="empty-state">
              <h2>No {silo.name} briefings yet</h2>
              <p>
                This category fills automatically as the pipeline publishes. In the meantime, browse
                the <Link href="/archive">full archive</Link>.
              </p>
            </div>
          ) : (
            <>
              <div className="card-grid">
                <PostCard post={lead} variant="lead" priority />
              </div>

              {rest.length > 0 && <AdUnit variant="below-title" />}

              <div className="card-grid">
                {rest.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            </>
          )}

          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: `${silo.name} — ${siteConfig.name}`,
              description: silo.description,
              url: `${siteConfig.url}/category/${silo.slug}`,
              hasPart: posts.slice(0, 20).map((post) => ({
                '@type': 'NewsArticle',
                headline: post.title,
                url: `${siteConfig.url}/posts/${post.slug}`,
                datePublished: post.date,
              })),
            }}
          />
        </div>

        <Sidebar latest={getAllPosts().slice(0, 6)} topics={getAllTopics().slice(0, 12)} />
      </div>
    </div>
  );
}
