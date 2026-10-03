/**
 * Converts rich text pasted from Google Docs, Medium, Notion or Substack to Markdown,
 * so headings and lists survive and Structure is scored fairly.
 */

import TurndownService from 'turndown';

let service: TurndownService | null = null;

function turndown(): TurndownService {
  if (service) return service;
  service = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' });
  // Google Docs wraps the whole selection in <b style="font-weight:normal" id="docs-internal-guid-…">.
  service.addRule('googleDocsWrapper', {
    filter: (node) => node.nodeName === 'B' && (node as HTMLElement).id?.startsWith('docs-internal-guid'),
    replacement: (content) => content,
  });
  service.remove(['script', 'style', 'meta', 'title']);
  return service;
}

// Only convert when the HTML carries structure; plain text from code editors stays as typed.
const STRUCTURE = /<(h[1-6]|li|blockquote|table|pre)\b/i;

/** Returns Markdown for structured HTML, or null to let the browser paste plain text. */
export function htmlToMarkdown(html: string): string | null {
  if (!STRUCTURE.test(html)) return null;
  try {
    const markdown = turndown().turndown(html).replace(/\n{3,}/g, '\n\n').trim();
    return markdown || null;
  } catch {
    return null;
  }
}
