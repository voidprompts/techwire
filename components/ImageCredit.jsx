import { UNSPLASH_ATTRIBUTION_URL } from '../lib/constants.mjs';

/**
 * Photographer attribution caption shown directly beneath a feature image.
 *
 * Renders nothing unless a credit name exists, so hand-written posts and
 * posts using a publisher's own image are unaffected.
 *
 * Output: Photo by <Name> on Unsplash
 * Both links carry the utm_source/utm_medium parameters Unsplash requires.
 */
export default function ImageCredit({ name, url, source = 'Unsplash', sourceUrl = UNSPLASH_ATTRIBUTION_URL }) {
  if (!name) return null;

  return (
    <figcaption className="image-credit">
      Photo by{' '}
      {url ? (
        <a href={url} rel="noopener noreferrer nofollow" target="_blank">
          {name}
        </a>
      ) : (
        name
      )}{' '}
      on{' '}
      <a href={sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
        {source}
      </a>
    </figcaption>
  );
}
