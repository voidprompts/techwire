import Link from 'next/link';
import siteConfig from '../../site.config.mjs';

export const metadata = {
  title: 'Privacy Policy',
  description:
    'How TechWire handles data: what we collect, the cookies used by advertising partners, and your rights under GDPR and CCPA.',
  alternates: { canonical: '/privacy-policy' },
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = 'January 1, 2025';

export default function PrivacyPolicyPage() {
  return (
    <div className="container page legal">
      <div className="page-head">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p>Effective date: {EFFECTIVE_DATE}</p>
      </div>

      <div className="prose">
        <p>
          This Privacy Policy explains how {siteConfig.name} (“we”, “us”, “the site”) handles
          information when you visit {siteConfig.url}. We have designed this site to collect as little
          personal data as technically possible. Please read this policy alongside our{' '}
          <Link href="/terms-of-service">Terms of Service</Link>.
        </p>

        <h2>1. Who we are</h2>
        <p>
          {siteConfig.name} is an independent technology news curation and analysis index. For any
          privacy question, or to exercise any right described below, contact us at{' '}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>. We act as the data controller
          for the limited processing described here.
        </p>

        <h2>2. Information we collect directly</h2>
        <p>
          <strong>None by default.</strong> This website is a static site. It has no accounts, no
          login, no comment system, no newsletter form and no database. We do not ask you for your
          name, email address, phone number or payment details, and we do not set first-party
          tracking cookies of our own.
        </p>
        <p>
          If you email us voluntarily, we receive whatever you choose to put in that email. We use it
          solely to reply to you and retain it only as long as needed for that correspondence.
        </p>

        <h2>3. Information collected automatically</h2>
        <h3>Server and CDN logs</h3>
        <p>
          Our static hosting provider (Cloudflare Pages or GitHub Pages) automatically records standard
          technical request data — IP address, user agent, requested URL, referrer and timestamp — for
          security, abuse prevention and aggregate traffic measurement. These logs are generated and
          retained by the hosting provider under their own privacy terms, and we do not use them to
          build profiles of individual visitors.
        </p>
        <h3>Third-party advertising</h3>
        <p>
          We display advertising to fund the site. Advertising partners may collect data through
          cookies, device identifiers and similar technologies. This is the main way any data about
          you is processed on this site.
        </p>

        <h2>4. Google AdSense and cookies</h2>
        <p>
          We use Google AdSense to serve advertisements. In connection with that service:
        </p>
        <ul>
          <li>
            Third-party vendors, including Google, use cookies to serve ads based on your prior visits
            to this website and other websites.
          </li>
          <li>
            Google’s use of advertising cookies enables it and its partners to serve ads to you based
            on your visit to this site and/or other sites on the internet.
          </li>
          <li>
            You may opt out of personalised advertising by visiting{' '}
            <a href="https://www.google.com/settings/ads" rel="noopener noreferrer" target="_blank">
              Google Ads Settings
            </a>
            . You can also opt out of third-party vendor cookies for personalised advertising at{' '}
            <a href="https://www.aboutads.info/choices/" rel="noopener noreferrer" target="_blank">
              aboutads.info/choices
            </a>{' '}
            or{' '}
            <a href="https://optout.networkadvertising.org/" rel="noopener noreferrer" target="_blank">
              optout.networkadvertising.org
            </a>
            .
          </li>
          <li>
            Google’s handling of data is governed by the{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              rel="noopener noreferrer"
              target="_blank"
            >
              Google Privacy &amp; Terms
            </a>{' '}
            page.
          </li>
        </ul>
        <p>
          Where required by law — including for visitors in the European Economic Area, the United
          Kingdom and Switzerland — advertising partners operate under a consent management framework,
          and personalised advertising cookies are only set where you have given consent. You may
          withdraw that consent at any time through the consent control provided on the page or via
          your browser settings.
        </p>

        <h2>5. Analytics</h2>
        <p>
          If and when we enable audience measurement, we use privacy-respecting, cookieless aggregate
          analytics that do not identify individual visitors and do not track users across other
          websites. This policy will be updated before any analytics provider that uses persistent
          identifiers is introduced.
        </p>

        <h2>6. Legal bases for processing (GDPR)</h2>
        <ul>
          <li>
            <strong>Legitimate interests</strong> — keeping the site secure and available, and
            understanding aggregate traffic levels.
          </li>
          <li>
            <strong>Consent</strong> — personalised advertising cookies and any non-essential storage,
            where consent is required by law.
          </li>
          <li>
            <strong>Legitimate interests / contract</strong> — responding to correspondence you
            initiate.
          </li>
        </ul>

        <h2>7. Your rights</h2>
        <p>
          Depending on where you live, you may have the right to access, correct, delete, restrict or
          object to the processing of your personal data, the right to data portability, and the right
          to lodge a complaint with your local supervisory authority. California residents have the
          right under the CCPA/CPRA to know what personal information is collected and to opt out of
          its “sale” or “sharing” for cross-context behavioural advertising. We do not sell personal
          information for money. To exercise any right, email{' '}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> and we will respond within the
          period required by applicable law.
        </p>

        <h2>8. Data retention</h2>
        <p>
          We do not maintain a visitor database. Hosting and CDN logs are retained by our provider for
          a short rolling period under their standard retention schedule. Email correspondence is kept
          only as long as necessary to handle your enquiry.
        </p>

        <h2>9. International transfers</h2>
        <p>
          Our hosting and advertising providers operate global infrastructure, so data may be
          processed in countries outside your own, including the United States. These providers rely
          on recognised transfer mechanisms such as the European Commission’s Standard Contractual
          Clauses and applicable adequacy frameworks.
        </p>

        <h2>10. Children’s privacy</h2>
        <p>
          This site is intended for a general, adult audience interested in technology. It is not
          directed to children under 13 (or under 16 in the EEA/UK), and we do not knowingly collect
          personal information from them. If you believe a child has provided us with personal
          information, contact us and we will delete it.
        </p>

        <h2>11. Security</h2>
        <p>
          The site is served exclusively over HTTPS from a static CDN. Because we operate no database
          and store no user records, the attack surface for personal data on this site is minimal.
        </p>

        <h2>12. External links</h2>
        <p>
          Our articles link to original reporting on third-party websites. We are not responsible for
          the privacy practices or content of those sites, and we encourage you to read their privacy
          policies.
        </p>

        <h2>13. Changes to this policy</h2>
        <p>
          We may update this policy to reflect changes in our practices or in the law. Material
          changes will be signalled by updating the effective date at the top of this page. Continued
          use of the site after an update constitutes acceptance of the revised policy.
        </p>

        <h2>14. Contact</h2>
        <p>
          Questions about this policy? Email{' '}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
        </p>
      </div>
    </div>
  );
}
