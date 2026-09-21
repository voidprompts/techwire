/** Renders pre-sanitized, build-time-generated article HTML. */
export default function Prose({ html, className = '' }) {
  if (!html) return null;
  return <div className={`prose ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
}
