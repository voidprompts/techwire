import Link from 'next/link';
import siteConfig from '../site.config.mjs';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div>
            <p className="site-footer__brand">{siteConfig.name}</p>
            <p className="site-footer__text">{siteConfig.descriptionLong}</p>
          </div>
          <nav className="site-footer__nav" aria-label="Footer">
            {siteConfig.footerNav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link href="/sitemap.xml">Sitemap</Link>
          </nav>
        </div>
        <p className="site-footer__legal">
          © {new Date().getFullYear()} {siteConfig.name}. Independent analysis. All referenced
          trademarks and source material remain the property of their respective owners.
        </p>
      </div>
    </footer>
  );
}
