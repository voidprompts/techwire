import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import { getAllPosts, getAllTopics } from '../../lib/posts';
import siteConfig from '../../site.config.mjs';

export const metadata = {
  title: 'About TechWire',
  description:
    'TechWire is an independent technology curation index publishing original analytical briefings on the stories moving the technology industry.',
  alternates: { canonical: '/about/' },
};

export default function AboutPage() {
  const posts = getAllPosts();

  return (
    <div className="container page legal">
      <div className="layout">
        <div>
          <div className="page-head">
            <p className="eyebrow">About</p>
            <h1>What {siteConfig.name} is, and how it works</h1>
            <p>
              An independent curation index for technology news, built to explain why a story matters
              rather than simply repeat that it happened.
            </p>
          </div>

          <div className="prose">
            <h2>Our role: a curation and analysis index</h2>
            <p>
              {siteConfig.name} is not a newswire and does not claim to break stories. We are a
              curation index. Our editorial system continuously monitors the technology industry’s
              primary publishers and community platforms — outlets such as TechCrunch, The Verge, Ars
              Technica, Hacker News and the wider developer community — identifies the developments
              with genuine long-term significance, and then publishes our own original written
              analysis of what those developments mean.
            </p>
            <p>
              Every article you read here is written from scratch. We do not republish, syndicate or
              copy source text. Where a story originates with another publication, we say so
              explicitly and link to that publication so you can read their reporting directly. The
              value we add is interpretation: the context, the second-order effects, the commercial
              logic and the technical trade-offs that a headline cannot carry.
            </p>

            <h2>Our editorial standards</h2>
            <h3>Originality</h3>
            <p>
              Articles are produced through an editorial pipeline that restructures publicly reported
              facts into wholly original prose. We do not reproduce paragraphs, direct quotes beyond
              brief attributed fragments, or images belonging to other publishers. Facts are not
              copyrightable; expression is — and our expression is our own.
            </p>
            <h3>Attribution</h3>
            <p>
              When a briefing is based on another publication’s reporting, it carries a clearly marked
              reporting reference pointing back to the outlet that did the original journalism. We
              consider that link a duty, not a courtesy.
            </p>
            <h3>Proportion over sensationalism</h3>
            <p>
              We deliberately avoid clickbait framing, manufactured outrage and speculative claims
              presented as fact. If something is unconfirmed, we label it unconfirmed. If a claim
              comes from a vendor’s own marketing, we say that too.
            </p>
            <h3>Corrections</h3>
            <p>
              If we get something wrong, we want to fix it. Email{' '}
              <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with the article URL and
              the correction, and we will review it promptly. Substantive corrections are noted in the
              article itself.
            </p>

            <h2>How the site is built</h2>
            <p>
              {siteConfig.name} is intentionally simple infrastructure. The entire site is a static
              build: there is no database, no user accounts and no server-side session tracking.
              Articles are stored as plain Markdown files in a public Git repository, rendered into
              static HTML at build time by Next.js, and served from a global CDN. That architecture is
              why pages load close to instantly, and it is also why we collect so little data about
              you — there is simply no backend to collect it with.
            </p>

            <h2>How we are funded</h2>
            <p>
              The site is supported by contextual display advertising. Advertising slots are clearly
              labelled and are never sold as editorial coverage. Advertisers have no input into what we
              cover or how we cover it, and no advertiser sees an article before publication. You can
              read exactly what advertising partners may collect in our{' '}
              <Link href="/privacy-policy">Privacy Policy</Link>.
            </p>

            <h2>Scope of coverage</h2>
            <p>
              We concentrate on artificial intelligence and machine learning infrastructure, consumer
              and enterprise hardware, software platforms and developer tooling, cybersecurity, space
              and deep tech, and the regulatory and commercial forces shaping all of the above.
              Browse the <Link href="/topics">topics index</Link> to see the current coverage map, or
              jump into the <Link href="/archive">full archive</Link>
              {posts.length > 0 ? ` of ${posts.length} briefings` : ''}.
            </p>

            <h2>Contact</h2>
            <p>
              Story tips, corrections, takedown requests and advertising enquiries all go to{' '}
              <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>, or use our{' '}
              <Link href="/contact">contact page</Link>. We read everything.
            </p>
          </div>
        </div>
        <Sidebar latest={posts.slice(0, 6)} topics={getAllTopics().slice(0, 10)} />
      </div>
    </div>
  );
}
