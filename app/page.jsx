import Link from 'next/link';
import PostCard from '../components/PostCard';
import Sidebar from '../components/Sidebar';
import AdUnit from '../components/AdUnit';
import { getAllPosts, getAllTopics, getSilosWithCounts } from '../lib/posts';
import { absoluteUrl, ogImages, twitterImages } from '../lib/seo.mjs';
import siteConfig from '../site.config.mjs';

export const metadata = {
  alternates: { canonical: '/' },
  // The homepage inherited no og:image from the root layout before, so every
  // share of the site root rendered as a bare card. Declared explicitly here.
  openGraph: {
    type: 'website',
    url: absoluteUrl('/'),
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: ogImages(),
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: twitterImages(),
  },
};

export default function HomePage() {
  const posts = getAllPosts();
  const topics = getAllTopics().slice(0, 12);
  // Only surface categories that actually hold something. An empty silo card
  // advertising "0 BRIEFINGS" is a dead end for readers and a thin, duplicate
  // landing page for crawlers. They reappear automatically on first publish.
  const silos = getSilosWithCounts().filter((silo) => silo.count > 0);
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

          {/* Category browser — puts every populated silo above the fold */}
          {silos.length > 0 && (
            <nav className="silo-grid" aria-label="Browse by category">
              {silos.map((silo) => (
                <Link key={silo.slug} href={`/category/${silo.slug}`} className="silo-card">
                  <span className="silo-card__emoji" aria-hidden="true">
                    {silo.emoji}
                  </span>
                  <span>
                    <span className="silo-card__name silo-card__name--full">{silo.name}</span>
                    <span className="silo-card__name silo-card__name--short" aria-hidden="true">
                      {silo.shortName}
                    </span>
                    <span className="silo-card__blurb">{silo.blurb}</span>
                    <span className="silo-card__count">
                      {silo.count} {silo.count === 1 ? 'briefing' : 'briefings'}
                    </span>
                  </span>
                </Link>
              ))}
            </nav>
          )}

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
