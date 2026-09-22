import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostCard from '../../../components/PostCard';
import Sidebar from '../../../components/Sidebar';
import AdUnit from '../../../components/AdUnit';
import JsonLd from '../../../components/JsonLd';
import { getAllPosts, getAllTopics, getPostsBySilo } from '../../../lib/posts';
import { absoluteUrl, ogImages, publisherSchema, twitterImages } from '../../../lib/seo.mjs';
import { SILOS, getSilo } from '../../../lib/silos.mjs';
import siteConfig from '../../../site.config.mjs';

/** One static page per silo. */
export function generateStaticParams() {
  return SILOS.map((silo) => ({ silo: silo.slug }));
}

export function generateMetadata({ params }) {
  const silo = getSilo(params.silo);
  if (!silo) return { title: 'Category not found' };
  const postCount = getPostsBySilo(silo.slug).length;
  const indexable = postCount >= siteConfig.categoryIndexThreshold;
  return {
    title: `${silo.name} news and analysis`,
    ...(!indexable ? { robots: { index: false, follow: true } } : {}),
    description: silo.description,
    alternates: { canonical: `/category/${silo.slug}/` },
    openGraph: {
      type: 'website',
      title: `${silo.name} — ${siteConfig.name}`,
      description: silo.description,
      url: absoluteUrl(`/category/${silo.slug}`),
      siteName: siteConfig.name,
      images: ogImages(),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${silo.name} — ${siteConfig.name}`,
      description: silo.description,
      images: twitterImages(),
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
              '@id': `${absoluteUrl(`/category/${silo.slug}`)}#collection`,
              name: `${silo.name} — ${siteConfig.name}`,
              description: silo.description,
              url: absoluteUrl(`/category/${silo.slug}`),
              inLanguage: 'en-US',
              isPartOf: { '@id': `${siteConfig.url}/#website` },
              publisher: publisherSchema(),
              // An ItemList of links, not inlined NewsArticle stubs. A bare
              // NewsArticle without publisher/logo/image is an incomplete
              // article entity and Google reports it as invalid markup; the
              // full article entity lives on the post page itself.
              mainEntity: {
                '@type': 'ItemList',
                itemListOrder: 'https://schema.org/ItemListOrderDescending',
                numberOfItems: posts.length,
                itemListElement: posts.slice(0, 20).map((post, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: post.title,
                  url: absoluteUrl(`/posts/${post.slug}`),
                })),
              },
            }}
          />
        </div>

        <Sidebar latest={getAllPosts().slice(0, 6)} topics={getAllTopics().slice(0, 12)} />
      </div>
    </div>
  );
}
