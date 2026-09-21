'use client';

import { useEffect, useRef } from 'react';
import siteConfig from '../site.config.mjs';

/**
 * Flexible, responsive Google AdSense container.
 *
 * The <ins class="adsbygoogle"> markup is always rendered so the layout reserves
 * space (no CLS) even before AdSense is approved. The push() call only fires when
 * NEXT_PUBLIC_ADSENSE_CLIENT is configured, so unapproved builds stay inert and
 * never emit console errors.
 *
 * variant:
 *  - "below-title"  leaderboard directly under the article H1
 *  - "in-article"   fluid unit injected mid-way through the body copy
 *  - "sidebar"      vertical unit inside the sticky desktop rail
 *  - "footer"       horizontal unit above the footer
 */
export default function AdUnit({ variant = 'in-article', slot, className = '', label = 'Advertisement' }) {
  const insRef = useRef(null);
  const pushed = useRef(false);
  const client = siteConfig.adsenseClient;
  const adSlot = slot || siteConfig.adSlots[toSlotKey(variant)] || '';

  useEffect(() => {
    if (!client || pushed.current) return;
    if (!insRef.current || insRef.current.getAttribute('data-adsbygoogle-status')) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense script blocked or not yet loaded — fail silently, never break the page.
    }
  }, [client]);

  const { format, layoutKey, fullWidth, style } = VARIANTS[variant] ?? VARIANTS['in-article'];

  return (
    <aside className={`ad-unit ad-unit--${variant} ${className}`.trim()} aria-label={label}>
      <span className="ad-unit__label">{label}</span>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={style}
        data-ad-client={client || undefined}
        data-ad-slot={adSlot || undefined}
        data-ad-format={format}
        data-ad-layout-key={layoutKey}
        data-full-width-responsive={fullWidth}
      />
    </aside>
  );
}

function toSlotKey(variant) {
  return {
    'below-title': 'belowTitle',
    'in-article': 'inArticle',
    sidebar: 'sidebar',
    footer: 'footer',
  }[variant];
}

const VARIANTS = {
  'below-title': {
    format: 'horizontal',
    fullWidth: 'true',
    style: { display: 'block', minHeight: 100 },
  },
  'in-article': {
    format: 'fluid',
    layoutKey: '-6t+ed+2i-1n-4w',
    fullWidth: 'true',
    style: { display: 'block', textAlign: 'center', minHeight: 250 },
  },
  sidebar: {
    format: 'vertical',
    fullWidth: 'false',
    style: { display: 'block', minHeight: 600 },
  },
  footer: {
    format: 'horizontal',
    fullWidth: 'true',
    style: { display: 'block', minHeight: 90 },
  },
};
