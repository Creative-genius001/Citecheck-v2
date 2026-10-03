/**
 * New-fact detection for rewrites: anything in the rewrite that wasn't in the
 * original is flagged for the writer to check. Text inside [[ADD: …]] is ignored.
 */

import { ADD_TOKEN, normalizeForMatch } from './text';

export type FactKind = 'number' | 'url' | 'quote' | 'name';

export interface NewFactFlag {
  kind: FactKind;
  /** Definite: certainly not in the original. Possible: heuristic, worth a look. */
  level: 'definite' | 'possible';
  value: string;
  /** The sentence it appears in. */
  context: string;
}

const MAX_FLAGS = 30;

// Optional currency, digits (thousands separators, decimals or a clock time like 9:30), then an
// optional "%" or "percent". Digits glued to a preceding letter ("web3", "H2", "p99") aren't numbers.
const NUMBER = /(?<![\p{L}\d.,:])([$€£]?)(\d[\d,]*(?:[.:]\d+)?)(\s?(?:%|percent\b|per cent\b))?/giu;
const URL = /https?:\/\/[^\s)\]>"'<]+/g;
const QUOTED = /["“]([^"“”\n]{3,300})["”]/g;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16',
  seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20', thirty: '30', forty: '40', fifty: '50',
  sixty: '60', seventy: '70', eighty: '80', ninety: '90', hundred: '100', thousand: '1000', first: '1',
  second: '2', third: '3', fourth: '4', fifth: '5', half: '50',
};

// Capitalized words that are rarely names even mid-sentence.
const NAME_STOPWORDS = new Set([
  'i', "i'm", "i've", "i'd", "i'll", 'ok', 'tl;dr', 'faq', 'fix', 'note', 'tip', 'step', 'example', 'summary',
]);

function numberCore(digits: string): string {
  const core = digits.replace(/,/g, '');
  return core.includes('.') ? core.replace(/\.?0+$/, '') || '0' : core;
}

interface NumberToken {
  /** time | percent | currency | plain */
  kind: 't' | '%' | '$' | 'n';
  core: string;
  /** Kind-qualified key: a percentage only matches a percentage, a time only a time. */
  key: string;
  text: string;
  index: number;
}

function numberTokens(line: string): NumberToken[] {
  return [...line.matchAll(NUMBER)].map((m) => {
    const digits = m[2].replace(/,+$/, '');
    const kind: NumberToken['kind'] = digits.includes(':') ? 't' : m[3] ? '%' : m[1] ? '$' : 'n';
    const core = kind === 't' ? digits : numberCore(digits);
    const key = kind === '$' ? `${m[1]}${core}` : `${kind}:${core}`;
    return { kind, core, key, text: `${m[1]}${digits}${m[3] ?? ''}`.trim(), index: m.index ?? 0 };
  });
}

interface NumberIndex {
  keys: Set<string>;
  /** Cores of every non-time number, plus number words ("three" → 3). */
  cores: Set<string>;
}

function numbersIn(text: string): NumberIndex {
  const keys = new Set<string>();
  const cores = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    for (const t of numberTokens(line.replace(LIST_MARKER, ''))) {
      keys.add(t.key);
      if (t.kind !== 't') cores.add(t.core);
    }
  }
  for (const word of text.toLowerCase().match(/\p{L}+/gu) ?? []) {
    if (NUMBER_WORDS[word]) cores.add(NUMBER_WORDS[word]);
  }
  return { keys, cores };
}

/** A plain number matches any original number with the same value; other kinds must match exactly. */
function isKnownNumber(t: NumberToken, original: NumberIndex): boolean {
  return t.kind === 'n' ? original.cores.has(t.core) : original.keys.has(t.key);
}

function sentenceAround(text: string, index: number): string {
  const before = text.lastIndexOf('\n', index);
  const after = text.indexOf('\n', index);
  const line = text.slice(before + 1, after === -1 ? text.length : after);
  const offset = index - (before + 1);
  const sentences = line.split(/(?<=[.!?])\s+/);
  let pos = 0;
  for (const s of sentences) {
    if (offset < pos + s.length + 1) return clip(s.replace(LIST_MARKER, '').replace(/^#{1,6}\s+/, ''));
    pos += s.length + 1;
  }
  return clip(line);
}

function clip(s: string): string {
  const t = s.trim();
  return t.length > 220 ? `${t.slice(0, 219).trimEnd()}…` : t;
}

function wordsIn(text: string): Set<string> {
  return new Set(text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

export function findNewFacts(original: string, rewrite: string): NewFactFlag[] {
  // Blank out placeholders but keep offsets, so contexts line up with the rewrite.
  const text = rewrite.replace(ADD_TOKEN, (m) => ' '.repeat(m.length));
  const originalNumbers = numbersIn(original);
  const originalNorm = normalizeForMatch(original);
  const originalWords = wordsIn(original);
  const definite: NewFactFlag[] = [];
  const possible: NewFactFlag[] = [];
  const seen = new Set<string>();

  const add = (list: NewFactFlag[], flag: NewFactFlag) => {
    const key = `${flag.kind}:${flag.value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push(flag);
  };

  // Numbers (list markers like "1." are structure, not facts).
  let lineStart = 0;
  for (const line of text.split('\n')) {
    const marker = line.match(LIST_MARKER);
    const skip = marker ? marker[0].length : 0;
    for (const t of numberTokens(line.slice(skip))) {
      if (isKnownNumber(t, originalNumbers)) continue;
      const smallPlain = t.kind === 'n' && !t.core.includes('.') && Number(t.core) <= 10;
      const index = lineStart + skip + t.index;
      add(smallPlain ? possible : definite, {
        kind: 'number',
        level: smallPlain ? 'possible' : 'definite',
        value: t.text,
        context: sentenceAround(text, index),
      });
    }
    lineStart += line.length + 1;
  }

  // Links.
  for (const m of text.matchAll(URL)) {
    const url = m[0].replace(/[.,;:!?]+$/, '');
    if (original.includes(url)) continue;
    add(definite, { kind: 'url', level: 'definite', value: url, context: sentenceAround(text, m.index ?? 0) });
  }

  // Quoted text longer than three words.
  for (const m of text.matchAll(QUOTED)) {
    const inner = m[1].trim();
    if (inner.split(/\s+/).length <= 3) continue;
    if (originalNorm.includes(normalizeForMatch(inner))) continue;
    add(definite, { kind: 'quote', level: 'definite', value: inner, context: sentenceAround(text, m.index ?? 0) });
  }

  // Capitalized names mid-sentence in prose (headings and tables are skipped: title case is noise there).
  lineStart = 0;
  for (const line of text.split('\n')) {
    const isHeadingOrTable = /^\s*(#{1,6}\s|\|)/.test(line);
    if (!isHeadingOrTable) {
      const prose = line.replace(/\[([^\]]*)\]\([^)]*\)/g, (_m, t: string) => t.padEnd(_m.length, ' ')).replace(/[*_`]/g, ' ');
      for (const sentence of prose.matchAll(/[^.!?]+[.!?]*/g)) {
        const tokens = [...sentence[0].matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’&-]*|[:;]/gu)];
        let group: RegExpMatchArray[] = [];
        const flush = () => {
          if (group.length) {
            const words = group.map((t) => t[0].replace(/['’]s$/, '').toLowerCase());
            const isNew = words.some((w) => !originalWords.has(w) && !NAME_STOPWORDS.has(w));
            if (isNew) {
              const value = group.map((t) => t[0]).join(' ');
              const index = lineStart + (sentence.index ?? 0) + (group[0].index ?? 0);
              add(possible, { kind: 'name', level: 'possible', value, context: sentenceAround(text, index) });
            }
          }
          group = [];
        };
        tokens.forEach((t, i) => {
          const prev = tokens[i - 1]?.[0];
          const startsClause = i === 0 || prev === ':' || prev === ';';
          if (!startsClause && /^\p{Lu}/u.test(t[0])) group.push(t);
          else flush();
        });
        flush();
      }
    }
    lineStart += line.length + 1;
  }

  return [...definite, ...possible].slice(0, MAX_FLAGS);
}
