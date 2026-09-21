import Link from 'next/link';

export const metadata = {
  title: 'Page not found',
  description: 'The page you requested does not exist on TechWire.',
};

export default function NotFound() {
  return (
    <div className="container page">
      <div className="empty-state" style={{ maxWidth: 640, margin: '60px auto' }}>
        <p className="eyebrow">Error 404</p>
        <h1>That page has moved on</h1>
        <p>
          The briefing you were looking for is not here. It may have been renamed, or the link may be
          incomplete.
        </p>
        <p>
          <Link href="/" className="tag">Back to the front page</Link>{' '}
          <Link href="/archive" className="tag">Browse the archive</Link>
        </p>
      </div>
    </div>
  );
}
