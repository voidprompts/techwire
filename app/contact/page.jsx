import siteConfig from '../../site.config.mjs';

export const metadata = {
  title: 'Contact',
  description:
    'Reach the TechWire editorial desk for story tips, factual corrections, rights and takedown requests, or advertising and partnership enquiries.',
  alternates: { canonical: '/contact/' },
};

const REASONS = [
  {
    title: 'Corrections',
    body: 'Spotted a factual error? Send the article URL and what is wrong. Verified corrections are applied quickly and noted in the article.',
  },
  {
    title: 'Story tips',
    body: 'Working on something the industry should know about? Tell us what it is and why it matters. We read every tip, though we cannot reply to all of them.',
  },
  {
    title: 'Rights and takedowns',
    body: 'If you are a rights holder and believe material on this site infringes your rights, include the URL, a description of the material and your contact details. We investigate all good-faith notices.',
  },
  {
    title: 'Advertising and partnerships',
    body: 'We sell clearly labelled display inventory only. Editorial coverage is never for sale.',
  },
];

export default function ContactPage() {
  return (
    <div className="container page legal">
      <div className="page-head">
        <p className="eyebrow">Get in touch</p>
        <h1>Contact the desk</h1>
        <p>
          One inbox, read by a human:{' '}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
        </p>
      </div>

      <div className="prose">
        <p>
          {siteConfig.name} runs no contact form, because the site is fully static and stores no
          visitor data. Email remains the fastest way to reach us, and it keeps your message out of
          any third-party form processor.
        </p>
        {REASONS.map((reason) => (
          <section key={reason.title}>
            <h2>{reason.title}</h2>
            <p>{reason.body}</p>
          </section>
        ))}
        <h2>Response times</h2>
        <p>
          We aim to acknowledge corrections and rights requests within two business days, and other
          enquiries within five. Please include the relevant article URL in every message — it saves a
          round trip.
        </p>
      </div>
    </div>
  );
}
