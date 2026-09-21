/**
 * TechWire content silos.
 *
 * Five fixed, high-traffic categories. Unlike the free-form `keywords` field
 * (which produces long-tail topic pages), silos are a closed set: they give the
 * site a stable IA, predictable internal linking, and clean nav.
 *
 * A post lands in a silo by:
 *   1. an explicit `category` in its front-matter (set by the AI pipeline), or
 *   2. pattern-matching its keywords and title (handles legacy/hand-written posts).
 *
 * Order here is the order rendered in the navigation.
 */

export const SILOS = [
  {
    slug: 'artificial-intelligence',
    name: 'Artificial Intelligence',
    shortName: 'AI',
    emoji: '🤖',
    blurb: 'LLMs, neural networks and automation tools',
    description:
      'Analysis of large language models, neural network research, AI infrastructure and the automation tools reshaping how software gets built.',
    // Ordered most-specific first; matched as whole words against keywords + title.
    patterns: [
      'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
      'large language model', 'llm', 'genai', 'generative ai', 'transformer',
      'inference', 'training run', 'fine-tuning', 'foundation model', 'diffusion model',
      'chatgpt', 'openai', 'anthropic', 'claude', 'gemini', 'copilot', 'agentic',
      'ai infrastructure', 'ai model', 'ai safety', 'alignment', 'prompt', 'embedding',
      'computer vision', 'speech recognition', 'automation', 'ai',
    ],
  },
  {
    slug: 'gadgets-hardware',
    name: 'Gadgets & Hardware',
    shortName: 'Hardware',
    emoji: '📱',
    blurb: 'Smartphones, chips, laptops and wearables',
    description:
      'Coverage of consumer and enterprise hardware: smartphones, silicon and chip architecture, laptops, wearables and the supply chains behind them.',
    patterns: [
      'smartphone', 'iphone', 'android phone', 'pixel phone', 'galaxy',
      'laptop', 'macbook', 'tablet', 'ipad', 'wearable', 'smartwatch', 'headphones',
      'earbuds', 'vr headset', 'ar glasses', 'console', 'camera',
      'chip', 'chipset', 'silicon', 'semiconductor', 'processor', 'cpu', 'gpu',
      'soc', 'foundry', 'tsmc', 'nvidia', 'arm', 'risc-v', 'fabrication',
      'hardware', 'device', 'gadget', 'battery', 'display', 'robotics', 'drone',
    ],
  },
  {
    slug: 'software-dev',
    name: 'Software & Dev',
    shortName: 'Software',
    emoji: '💻',
    blurb: 'Apps, open source and programming updates',
    description:
      'Reporting on applications, open-source projects, developer tooling, programming languages and the platform shifts that change how software is shipped.',
    patterns: [
      'open source', 'open-source', 'software licensing', 'licence', 'license',
      'programming language', 'javascript', 'typescript', 'python', 'rust', 'golang',
      'java', 'kotlin', 'swift', 'compiler', 'runtime', 'framework', 'library',
      'developer tool', 'developer', 'sdk', 'api', 'github', 'git', 'repository',
      'kubernetes', 'docker', 'container', 'devops', 'ci/cd', 'database',
      'operating system', 'linux', 'windows', 'macos', 'browser', 'web standard',
      'app', 'application', 'software', 'release', 'update', 'version',
    ],
  },
  {
    slug: 'cybersecurity',
    name: 'Cybersecurity',
    shortName: 'Security',
    emoji: '🔒',
    blurb: 'Privacy, patches and data security news',
    description:
      'Security and privacy analysis: vulnerabilities and patches, data breaches, encryption, surveillance and the regulation of personal data.',
    patterns: [
      'cybersecurity', 'security', 'vulnerability', 'exploit', 'zero-day', 'zero day',
      'cve', 'patch', 'malware', 'ransomware', 'phishing', 'breach', 'data breach',
      'hack', 'hacker', 'attack', 'threat actor', 'botnet', 'spyware',
      'encryption', 'cryptography', 'authentication', 'password', 'passkey',
      'privacy', 'gdpr', 'surveillance', 'tracking', 'data protection', 'infosec',
    ],
  },
  {
    slug: 'startups-business',
    name: 'Startups & Business',
    shortName: 'Business',
    emoji: '🚀',
    blurb: 'Funding, market shifts and major mergers',
    description:
      'The business of technology: venture funding and valuations, acquisitions and mergers, market strategy, regulation and antitrust.',
    patterns: [
      'startup', 'funding', 'venture capital', 'vc', 'seed round', 'series a',
      'series b', 'series c', 'valuation', 'ipo', 'acquisition', 'merger', 'acquire',
      'antitrust', 'regulator', 'regulation', 'lawsuit', 'investor', 'earnings',
      'revenue', 'profit', 'layoff', 'restructuring', 'market share', 'monetisation',
      'monetization', 'business model', 'pricing', 'enterprise software', 'saas',
      'cloud pricing', 'economics', 'commercial',
    ],
  },
];

export const DEFAULT_SILO = SILOS[0];

const BY_SLUG = new Map(SILOS.map((silo) => [silo.slug, silo]));

export function getSilo(slug) {
  return BY_SLUG.get(slug) || null;
}

export function getAllSilos() {
  return SILOS;
}

/** Normalize for matching: lowercase, punctuation to spaces, collapse whitespace. */
function normalize(text) {
  return ` ${String(text).toLowerCase().replace(/[^a-z0-9+#/-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

/**
 * Score how strongly a haystack matches a silo.
 * Multi-word patterns score higher than single words, because "ai infrastructure"
 * is far stronger evidence than a bare "ai" appearing somewhere in the title.
 */
function scoreSilo(silo, keywordText, titleText) {
  let score = 0;
  let distinct = 0;

  for (const pattern of silo.patterns) {
    const weight = pattern.includes(' ') ? 3 : 1;
    // Keyword matches are worth more than title matches — keywords are curated.
    if (matches(keywordText, pattern)) {
      score += weight * 3;
      distinct += 1;
    } else if (matches(titleText, pattern)) {
      score += weight;
      distinct += 1;
    }
  }

  // Breadth bonus: a silo matching several distinct terms is a better fit than
  // one matching a single broad phrase. Without this, an article about chips
  // that merely mentions "AI infrastructure" gets pulled into the AI silo.
  return score + distinct * 4;
}

/**
 * Whole-word match tolerant of simple English plurals, so "semiconductors"
 * matches the pattern "semiconductor" and "chips" matches "chip".
 */
function matches(haystack, pattern) {
  if (haystack.includes(` ${pattern} `)) return true;
  // Irregular/awkward plurals are not worth a stemmer here; handle the common cases.
  if (haystack.includes(` ${pattern}s `)) return true;
  if (pattern.endsWith('y') && haystack.includes(` ${pattern.slice(0, -1)}ies `)) return true;
  if (/(ch|sh|s|x|z)$/.test(pattern) && haystack.includes(` ${pattern}es `)) return true;
  return false;
}

/**
 * Resolve a post to exactly one silo.
 * `category` in front-matter wins; otherwise infer from keywords and title.
 * Always returns a silo so no post is ever orphaned from the navigation.
 */
export function classifyPost({ category, keywords = [], title = '' }) {
  if (category) {
    const explicit = BY_SLUG.get(String(category).trim().toLowerCase());
    if (explicit) return explicit;
  }

  const keywordText = normalize(keywords.join(' '));
  const titleText = normalize(title);

  let best = null;
  let bestScore = 0;
  for (const silo of SILOS) {
    const score = scoreSilo(silo, keywordText, titleText);
    if (score > bestScore) {
      best = silo;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : DEFAULT_SILO;
}

/** Valid `category` values, for the AI prompt and front-matter validation. */
export const SILO_SLUGS = SILOS.map((silo) => silo.slug);
