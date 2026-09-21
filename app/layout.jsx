import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AdsenseScript from '../components/AdsenseScript';
import AdUnit from '../components/AdUnit';
import JsonLd from '../components/JsonLd';
import siteConfig from '../site.config.mjs';

export const metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  referrer: 'strict-origin-when-cross-origin',
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  alternates: { canonical: '/', types: { 'application/rss+xml': '/rss.xml' } },
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    url: siteConfig.url,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: { card: 'summary_large_image', title: siteConfig.name, description: siteConfig.description },
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
            '@type': 'WebSite',
            name: siteConfig.name,
            url: siteConfig.url,
            description: siteConfig.description,
            publisher: {
              '@type': 'Organization',
              name: siteConfig.name,
              url: siteConfig.url,
            },
          }}
        />
      </body>
    </html>
  );
}
