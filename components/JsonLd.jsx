/** Inline JSON-LD structured data. Rendered as a static <script> tag at build time. */
export default function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      // Content is generated from our own front-matter, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
