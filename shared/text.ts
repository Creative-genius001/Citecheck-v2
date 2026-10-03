/**
 * Text helpers shared by the server, the UI and the tests.
 */

export const LIMITS = {
  minWords: 150,
  maxWords: 15_000,
  maxChars: 200_000,
  maxAuthor: 300,
  maxTopic: 200,
} as const;

/** Words are whitespace-separated tokens containing a letter or digit, so Markdown symbols don't count. */
export function countWords(text: string): number {
  let n = 0;
  for (const token of text.split(/\s+/)) {
    if (/[\p{L}\p{N}]/u.test(token)) n++;
  }
  return n;
}

/**
 * Normalizes text for quote matching: Unicode NFKC, straight quotes and dashes,
 * Markdown markers removed, links reduced to their text, whitespace collapsed, lowercase.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const EDGE_PUNCTUATION = /^[\s"'.,;:!?()-]+|[\s"'.,;:!?()-]+$/g;

/**
 * A quote is verified when its normalized form appears in the normalized article.
 * Leading and trailing punctuation is ignored. If the model used an ellipsis,
 * every segment must appear, in order.
 */
export function isQuoteInArticle(quote: string, normalizedArticle: string): boolean {
  const segments = normalizeForMatch(quote)
    .split('...')
    .map((s) => s.replace(EDGE_PUNCTUATION, ''))
    .filter(Boolean);
  if (segments.length === 0) return false;

  let from = 0;
  for (const segment of segments) {
    const at = normalizedArticle.indexOf(segment, from);
    if (at === -1) return false;
    from = at + segment.length;
  }
  return true;
}

/** The article's first `# heading`, or its first non-empty line, without Markdown markers. */
export function articleTitle(markdown: string): string {
  const lines = markdown.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const heading = lines.find((l) => /^#\s+/.test(l));
  const raw = (heading ?? lines[0] ?? '').replace(/^#{1,6}\s+/, '');
  const clean = raw.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim();
  if (!clean) return 'Untitled article';
  return clean.length > 140 ? `${clean.slice(0, 139).trimEnd()}…` : clean;
}

/** `[[ADD: …]]` marks information the writer has to supply. */
export const ADD_TOKEN = /\[\[ADD:[^\]]*\]\]/g;

export type TextPart = { kind: 'text' | 'add'; value: string };

export function splitAddTokens(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(ADD_TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ kind: 'text', value: text.slice(last, at) });
    parts.push({ kind: 'add', value: match[0] });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}

export function extractPlaceholders(text: string): string[] {
  return [...text.matchAll(ADD_TOKEN)].map((m) => m[0]);
}
