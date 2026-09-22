import fs from 'node:fs';
import path from 'node:path';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AdsenseScript from '../components/AdsenseScript';
import AdUnit from '../components/AdUnit';
import JsonLd from '../components/JsonLd';
import { absoluteUrl, ogImages, publisherSchema, twitterImages, verificationMeta } from '../lib/seo.mjs';
import siteConfig, { withBasePath } from '../site.config.mjs';

// Pages is a pure static export, so read the canonical stylesheet while Next
// renders each document. This guarantees the CSS is in the HTML even when a
// hosting provider invokes `next build` directly and bypasses npm's postbuild
// lifecycle hook.
const globalCss = fs
  .readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8')
  .replace(/<\/style/gi, '<\\/style');

export const metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  referrer: 'strict-origin-when-cross-origin',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  // Canonical must carry the trailing slash that next.config's trailingSlash
  // emits, otherwise the canonical points at a URL that redirects.
  alternates: { canonical: '/', types: { 'application/rss+xml': '/rss.xml' } },
  // Icons. Without these Google renders a generic globe next to the result and
  // in the browser tab. /app/{favicon.ico,icon.png,apple-icon.png} are picked up
  // by Next's file convention; these entries add the sizes Android/PWA use.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/images/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  // Search Console / Bing / Yandex ownership tokens (no-ops when unset).
  verification: verificationMeta(),
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    url: absoluteUrl('/'),
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    // Site-wide fallback share card so no page ships a bare link preview.
    images: ogImages(),
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: twitterImages(),
  },
  other: siteConfig.adsenseClient ? { 'google-adsense-account': siteConfig.adsenseClient } : undefined,
};

export const viewport = {
  themeColor: '#0b1020',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style data-techwire-global-css dangerouslySetInnerHTML={{ __html: globalCss }} />
        {/* Declared here rather than via metadata.manifest: Next stamps that one
            with crossorigin="use-credentials", which makes the fetch fail on a
            plain static host that does not echo CORS credentials headers. */}
        <link rel="manifest" href={withBasePath('/site.webmanifest')} />
        {/* Preconnect to the ad network only when it is actually used. */}
        {siteConfig.adsenseClient && (
          <>
            <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
            <link rel="preconnect" href="https://googleads.g.doubleclick.net" crossOrigin="anonymous" />
          </>
        )}
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <div className="container">
          <AdUnit variant="footer" />
        </div>
        <Footer />
        <AdsenseScript />
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              // Organization carries the publisher logo that article rich
              // results require; every other node references it by @id.
              publisherSchema(),
              {
                '@type': 'WebSite',
                '@id': `${siteConfig.url}/#website`,
                name: siteConfig.name,
                alternateName: siteConfig.tagline,
                url: absoluteUrl('/'),
                description: siteConfig.description,
                inLanguage: 'en-US',
                publisher: { '@id': `${siteConfig.url}/#organization` },
              },
            ],
          }}
        />
      </body>
    </html>
  );
}
