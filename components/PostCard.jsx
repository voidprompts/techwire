import Image from 'next/image';
import Link from 'next/link';
import { formatDate } from '../lib/posts';

/**
 * Article teaser card.
 * `priority` should only be true for the first above-the-fold image (LCP element).
 */
export default function PostCard({ post, priority = false, variant = 'default' }) {
  const hasImage = Boolean(post.image);

  return (
    <article className={`card card--${variant}`}>
      <Link href={`/posts/${post.slug}`} className="card__media" tabIndex={-1} aria-hidden="true">
        {hasImage ? (
          <Image
            src={post.image}
            alt=""
            width={variant === 'lead' ? 1200 : 640}
            height={variant === 'lead' ? 675 : 360}
            sizes={variant === 'lead' ? '(max-width: 900px) 100vw, 720px' : '(max-width: 900px) 100vw, 360px'}
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            className="card__image"
          />
        ) : (
          <div className="card__image card__image--fallback" />
        )}
      </Link>
      <div className="card__body">
        <div className="card__meta">
          {post.silo && (
            <>
              <Link href={`/category/${post.silo.slug}`} className="card__silo">
                <span aria-hidden="true">{post.silo.emoji}</span> {post.silo.shortName}
              </Link>
              <span aria-hidden="true">•</span>
            </>
          )}
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span aria-hidden="true">•</span>
          <span>{post.readingTime} min read</span>
        </div>
        <h2 className="card__title">
          <Link href={`/posts/${post.slug}`}>{post.title}</Link>
        </h2>
        <p className="card__excerpt">{post.excerpt}</p>
      </div>
    </article>
  );
}
