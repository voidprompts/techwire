'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { SILOS } from '../lib/silos.mjs';

const UTILITY_LINKS = [
  { href: '/archive', label: 'Archive' },
  { href: '/about', label: 'About' },
];

/**
 * Primary site navigation, organised by content silo.
 *
 * Desktop  : a single horizontal row of the five silos + utility links.
 * Mobile   : a disclosure menu behind a hamburger button.
 *
 * Kept as a client component only because the mobile menu needs open/close
 * state and route-change handling; the markup itself is fully static.
 */
export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef(null);

  // Close the menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the menu and returns focus to the toggle.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Prevent the page behind the open mobile menu from scrolling.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="nav-toggle__bars" data-open={open || undefined} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="nav-toggle__text">Menu</span>
      </button>

      <nav
        id={menuId}
        className="site-nav"
        data-open={open || undefined}
        aria-label="Primary"
      >
        <ul className="site-nav__list">
          {SILOS.map((silo) => (
            <li key={silo.slug}>
              <Link
                href={`/category/${silo.slug}`}
                className="site-nav__link"
                aria-current={isActive(`/category/${silo.slug}`) ? 'page' : undefined}
              >
                <span className="site-nav__emoji" aria-hidden="true">
                  {silo.emoji}
                </span>
                <span className="site-nav__label">
                  {/* Full name in the mobile menu; short name in the desktop bar
                      where horizontal space is tight. CSS toggles which shows. */}
                  <span className="site-nav__name site-nav__name--full">{silo.name}</span>
                  <span className="site-nav__name site-nav__name--short" aria-hidden="true">
                    {silo.shortName}
                  </span>
                  <span className="site-nav__blurb">{silo.blurb}</span>
                </span>
              </Link>
            </li>
          ))}

          <li className="site-nav__divider" role="presentation" />

          {UTILITY_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="site-nav__link site-nav__link--utility"
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                <span className="site-nav__label">
                  <span className="site-nav__name">{item.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Click-away backdrop for the mobile menu */}
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
    </>
  );
}
