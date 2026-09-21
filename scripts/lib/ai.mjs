import { PIPELINE } from '../config.mjs';
import { fetchWithTimeout, log, withRetry } from './utils.mjs';

/**
 * AI content engine.
 *
 * Supports two 100% free developer tiers:
 *  - Google Gemini 1.5 Flash  (GEMINI_API_KEY)
 *  - Groq  Llama 3.3 70B      (GROQ_API_KEY)
 *
 * Provider is chosen by AI_PROVIDER, or auto-detected from whichever key exists.
 * Both providers are asked for strict JSON so the output maps 1:1 onto front-matter.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export function resolveProvider() {
  const explicit = (process.env.AI_PROVIDER || '').toLowerCase();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  if (explicit === 'gemini') {
    if (!hasGemini) throw new Error('AI_PROVIDER=gemini but GEMINI_API_KEY is not set.');
    return 'gemini';
  }
  if (explicit === 'groq') {
    if (!hasGroq) throw new Error('AI_PROVIDER=groq but GROQ_API_KEY is not set.');
    return 'groq';
  }
  if (hasGemini) return 'gemini';
  if (hasGroq) return 'groq';
  throw new Error(
    'No AI key found. Set GEMINI_API_KEY (Google AI Studio) or GROQ_API_KEY (console.groq.com).'
  );
}

const SYSTEM_PROMPT = `You are the senior technology analyst and SEO editor for TechWire, an independent technology curation index.

You receive the raw text of a news story that another outlet published. You must produce an ORIGINAL analytical briefing about the underlying development. You are a commentator and analyst, never a copyist.

NON-NEGOTIABLE PUBLISHING POLICY (Google AdSense / Google Publisher Policies):
1. ORIGINALITY: Every sentence must be written from scratch in your own words. Never reuse a phrase of more than four consecutive words from the source. No copied paragraphs, no light paraphrase of the source's sentence structure, no scraped snippets.
2. NO PLAGIARISM OR COPYRIGHT RISK: Do not reproduce quotes from the source, do not describe copyrighted images, do not invent quotes. Facts are fine; the expression must be yours.
3. UNIQUE VALUE: The reader must get something the source article did not give them — context on why it matters, the commercial or technical mechanism at work, second-order effects, historical precedent, and what to watch next. Analysis is the product.
4. NO SENSATIONALISM: No clickbait, no outrage framing, no ALL CAPS, no exclamation marks, no "you won't believe", no fabricated urgency. Measured, professional, expert tone.
5. ACCURACY AND HONESTY: Never invent facts, numbers, dates, product names or company statements that are not supported by the source text. If something is unconfirmed or speculative, explicitly label it as such. Prefer "reportedly" and "according to the original reporting" over false certainty.
6. NO MEDICAL, LEGAL OR FINANCIAL ADVICE. No investment recommendations.

SEO COPYWRITING REQUIREMENTS:
- Identify ONE primary keyword (the natural search phrase for this story) plus 4-7 secondary keywords.
- The H1 title must contain the primary keyword, read naturally, be genuinely click-worthy without being clickbait, and be 50-65 characters.
- The meta description must be 140-155 characters, contain the primary keyword, and summarise the value of the analysis.
- The body must be 800-1200 words of markdown.
- Structure with 4-6 "## " H2 subheadings, and use "### " H3 subheadings where a section needs sub-points. Headings must be descriptive and keyword-aware, never generic ("Introduction", "Conclusion" are banned).
- Naturally blend the primary and secondary keywords through the copy — target roughly 1-2% density. Never keyword-stuff.
- Open with a 2-3 sentence direct answer to "what happened and why does it matter", because that wins featured snippets.
- Include at least one bulleted or numbered list where it genuinely aids scanning.
- Explain technical terms in plain language the first time they appear.
- End with a forward-looking "what to watch" style section, using a descriptive heading.
- Do NOT include the H1 in the markdown body (it is rendered from the title field).
- Do NOT include images, HTML, front-matter, or links to the source in the body.

OUTPUT FORMAT: Return ONLY a single valid JSON object, no markdown fences, no commentary, matching exactly:
{
  "title": "string, 50-65 chars, contains primary keyword",
  "description": "string, 140-155 chars",
  "keywords": ["primary keyword", "secondary", "..."],
  "body_markdown": "string, 800-1200 words of markdown using ## and ### headings",
  "primary_keyword": "string",
  "confidence": 0.0
}
"confidence" is your 0-1 assessment of whether the source text contained enough substance to write a genuinely useful, factually grounded analysis. Use below 0.4 if the source was too thin, paywalled, or not really a technology story.`;

function buildUserPrompt({ sourceTitle, sourceName, sourceUrl, publishedAt, text }) {
  return `SOURCE METADATA
Outlet: ${sourceName || 'unknown'}
Original headline: ${sourceTitle}
URL: ${sourceUrl}
Published: ${publishedAt || 'unknown'}

RAW SOURCE TEXT (reference only — never copy its wording):
"""
${text}
"""

TASK
Write TechWire's original analytical briefing on this development, following every policy and SEO rule in your instructions. Target ${PIPELINE.targetWordsMin}-${PIPELINE.targetWordsMax} words in body_markdown. Return the JSON object only.`;
}

/** Strip code fences and isolate the outermost JSON object. */
function parseJsonResponse(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Empty AI response');
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('AI response contained no JSON object');
  const slice = text.slice(start, end + 1);

  try {
    return JSON.parse(slice);
  } catch {
    // Second chance: repair the most common LLM JSON defects.
    const repaired = slice
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
    return JSON.parse(repaired);
  }
}

async function callGemini(userPrompt) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    timeoutMs: 120000,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.65,
        topP: 0.95,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        'HARM_CATEGORY_HARASSMENT',
        'HARM_CATEGORY_HATE_SPEECH',
        'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        'HARM_CATEGORY_DANGEROUS_CONTENT',
      ].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Gemini HTTP ${response.status}: ${detail.slice(0, 300)}`);
    if ([400, 401, 403].includes(response.status)) error.fatal = true;
    throw error;
  }

  const json = await response.json();
  const candidate = json?.candidates?.[0];
  if (!candidate) throw new Error(`Gemini returned no candidates (${json?.promptFeedback?.blockReason || 'unknown'})`);
  if (candidate.finishReason === 'SAFETY') {
    const error = new Error('Gemini blocked the request for safety');
    error.fatal = true;
    throw error;
  }
  const text = (candidate.content?.parts || []).map((part) => part.text || '').join('');
  return parseJsonResponse(text);
}

async function callGroq(userPrompt) {
  const key = process.env.GROQ_API_KEY;
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    timeoutMs: 120000,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.65,
      top_p: 0.95,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Groq HTTP ${response.status}: ${detail.slice(0, 300)}`);
    if ([400, 401, 403, 404].includes(response.status)) error.fatal = true;
    throw error;
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;
  return parseJsonResponse(text);
}

const PROVIDERS = { gemini: callGemini, groq: callGroq };

/**
 * Transform a scraped article into an original, SEO-structured briefing.
 * Throws on unrecoverable provider errors; returns a validated object otherwise.
 */
export async function generateArticle(input, provider = resolveProvider()) {
  const call = PROVIDERS[provider];
  if (!call) throw new Error(`Unsupported AI provider "${provider}"`);

  const userPrompt = buildUserPrompt(input);
  const result = await withRetry(() => call(userPrompt), {
    retries: PIPELINE.maxRetries,
    baseDelay: 2500,
    label: `${provider} generation`,
  });

  return validateResult(result, input);
}

/** Normalize and sanity-check the model output before it ever reaches disk. */
function validateResult(result, input) {
  if (!result || typeof result !== 'object') throw new Error('AI returned a non-object payload');

  const title = String(result.title || '').replace(/\s+/g, ' ').trim().replace(/^["']|["']$/g, '');
  const description = String(result.description || '').replace(/\s+/g, ' ').trim();
  let body = String(result.body_markdown || result.body || '').trim();

  if (!title) throw new Error('AI output missing title');
  if (!body) throw new Error('AI output missing body_markdown');

  // The H1 is rendered from front-matter; remove any duplicate the model added.
  body = body.replace(/^#\s+.*\n+/, '').trim();
  // Demote any stray H1s inside the body to H2 to keep one H1 per page.
  body = body.replace(/^#\s+(?!#)/gm, '## ');

  const wordCount = body.split(/\s+/).filter(Boolean).length;
  if (wordCount < 450) throw new Error(`AI body too short (${wordCount} words)`);

  const keywords = (Array.isArray(result.keywords) ? result.keywords : [])
    .map((k) => String(k).toLowerCase().trim())
    .filter((k) => k && k.length < 40)
    .slice(0, 8);

  const confidence = Number(result.confidence);

  return {
    title,
    description: description || `${title}. Independent analysis from TechWire.`,
    keywords: keywords.length ? keywords : ['technology'],
    body,
    primaryKeyword: String(result.primary_keyword || keywords[0] || '').trim(),
    confidence: Number.isFinite(confidence) ? confidence : 0.5,
    wordCount,
    sourceUrl: input.sourceUrl,
  };
}

export { SYSTEM_PROMPT };
