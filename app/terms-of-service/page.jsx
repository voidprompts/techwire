import Link from 'next/link';
import siteConfig from '../../site.config.mjs';

export const metadata = {
  title: 'Terms of Service',
  description:
    'The terms governing use of TechWire, including intellectual property, acceptable use, disclaimers and limitation of liability.',
  alternates: { canonical: '/terms-of-service/' },
};

const EFFECTIVE_DATE = 'January 1, 2025';

export default function TermsPage() {
  return (
    <div className="container page legal">
      <div className="page-head">
        <p className="eyebrow">Legal</p>
        <h1>Terms of Service</h1>
        <p>Effective date: {EFFECTIVE_DATE}</p>
      </div>

      <div className="prose">
        <p>
          These Terms of Service (“Terms”) govern your access to and use of {siteConfig.name} at{' '}
          {siteConfig.url} (the “Site”). By accessing or using the Site you agree to be bound by these
          Terms. If you do not agree, please do not use the Site.
        </p>

        <h2>1. The service we provide</h2>
        <p>
          {siteConfig.name} is an independent technology news curation and analysis index. We publish
          original editorial commentary about publicly reported developments in the technology
          industry. The Site is provided free of charge and is supported by advertising.
        </p>

        <h2>2. Editorial nature of the content</h2>
        <p>
          Our articles are analysis and opinion informed by public reporting. They are not, and must
          not be relied upon as, investment advice, legal advice, security advice, or professional
          guidance of any kind. Technology moves quickly and facts change; content is accurate to the
          best of our knowledge at the time of publication only.
        </p>

        <h2>3. Intellectual property</h2>
        <h3>Our content</h3>
        <p>
          All original text, layout, design, graphics and source code on the Site are owned by{' '}
          {siteConfig.name} or its licensors and are protected by copyright and other intellectual
          property laws. You may read, link to and quote briefly from our articles with clear
          attribution and a link back to the original page. You may not republish articles in full,
          scrape the Site to create substitute products, or use our content to train commercial
          machine-learning models without prior written permission.
        </p>
        <h3>Third-party material</h3>
        <p>
          Trademarks, product names, logos and any quoted fragments referenced in our articles remain
          the property of their respective owners and are used for identification and commentary
          purposes under applicable fair-use or fair-dealing principles. Where an article discusses
          reporting first published elsewhere, that outlet is credited and linked.
        </p>
        <h3>Rights holder requests</h3>
        <p>
          If you believe content on the Site infringes your rights, email{' '}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with the URL, a description of
          the material and your contact details. We investigate all good-faith notices promptly and
          will remove or amend material where a claim is substantiated.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>use automated systems to access the Site in a way that degrades performance for others;</li>
          <li>attempt to gain unauthorised access to the Site, its hosting infrastructure or repository;</li>
          <li>interfere with, obscure or artificially interact with advertisements displayed on the Site;</li>
          <li>use the Site for any unlawful purpose or in breach of any applicable regulation;</li>
          <li>misrepresent your affiliation with {siteConfig.name}.</li>
        </ul>

        <h2>5. Advertising</h2>
        <p>
          The Site displays third-party advertising. Advertisements are labelled and are independent of
          our editorial content; advertisers do not review or influence articles. We are not
          responsible for the content, products, services or claims of any advertiser, and any
          transaction you enter into with an advertiser is solely between you and them. Deliberate
          manipulation of advertisements, including invalid clicks, is strictly prohibited.
        </p>

        <h2>6. Third-party links</h2>
        <p>
          The Site links to external websites we do not control. Those links are provided for
          attribution and reference only and do not constitute an endorsement. We accept no
          responsibility for the availability, accuracy or content of external sites.
        </p>

        <h2>7. Availability</h2>
        <p>
          We aim to keep the Site available at all times but provide no guarantee of uninterrupted
          access. We may modify, suspend or discontinue any part of the Site — including individual
          articles — at any time without notice.
        </p>

        <h2>8. Disclaimer of warranties</h2>
        <p>
          The Site and all content are provided “as is” and “as available”, without warranties of any
          kind, whether express or implied, including implied warranties of merchantability, fitness
          for a particular purpose, accuracy and non-infringement, to the maximum extent permitted by
          applicable law.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, {siteConfig.name} and its contributors shall not be
          liable for any indirect, incidental, special, consequential or punitive damages, or for any
          loss of profits, data, business or goodwill, arising out of or in connection with your use
          of — or inability to use — the Site, even if advised of the possibility of such damages.
          Nothing in these Terms excludes liability that cannot lawfully be excluded.
        </p>

        <h2>10. Indemnity</h2>
        <p>
          You agree to indemnify and hold harmless {siteConfig.name} against any claims, losses,
          liabilities and reasonable legal costs arising from your breach of these Terms or your
          misuse of the Site.
        </p>

        <h2>11. Privacy</h2>
        <p>
          Your use of the Site is also governed by our{' '}
          <Link href="/privacy-policy">Privacy Policy</Link>, which explains how data is handled.
        </p>

        <h2>12. Changes to these Terms</h2>
        <p>
          We may revise these Terms from time to time. The effective date at the top of this page
          indicates the latest revision. Your continued use of the Site after changes take effect
          constitutes acceptance of the revised Terms.
        </p>

        <h2>13. Governing law and severability</h2>
        <p>
          These Terms are governed by the laws applicable at the operator’s principal place of
          business, without regard to conflict-of-law rules. If any provision is found unenforceable,
          the remaining provisions remain in full force and effect.
        </p>

        <h2>14. Contact</h2>
        <p>
          Questions about these Terms? Email{' '}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
        </p>
      </div>
    </div>
  );
}
