import Script from 'next/script';
import siteConfig from '../site.config.mjs';

/**
 * Loads the AdSense loader script once, after hydration, so it never blocks LCP.
 * Renders nothing until a publisher id is configured.
 */
export default function AdsenseScript() {
  if (!siteConfig.adsenseClient) return null;
  return (
    <Script
      id="adsbygoogle-init"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${siteConfig.adsenseClient}`}
    />
  );
}
