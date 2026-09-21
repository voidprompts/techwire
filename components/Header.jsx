import Link from 'next/link';
import Nav from './Nav';
import siteConfig from '../site.config.mjs';

export default function Header() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand" aria-label={`${siteConfig.name} home`}>
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l5-5-5-5" />
              <path d="M12 19h9" />
            </svg>
          </span>
          <span className="brand__text">
            <strong>{siteConfig.name}</strong>
            <small>{siteConfig.tagline}</small>
          </span>
        </Link>
        <Nav />
      </div>
    </header>
  );
}
