import { describe, expect, it } from 'vitest';
import { articleTitle, countWords, extractPlaceholders, isQuoteInArticle, normalizeForMatch, splitAddTokens } from '../shared/text';

describe('countWords', () => {
  it('ignores Markdown symbols', () => {
    expect(countWords('# Title\n\n- one two\n\n| a | b |\n|---|---|')).toBe(5);
    expect(countWords('   ')).toBe(0);
  });
});

describe('isQuoteInArticle', () => {
  const article = normalizeForMatch(
    '## Why it matters\n\nFees on **most** rollups are now a fraction of mainnet — at least in our tests. See [the docs](https://example.com) for details.',
  );

  it('matches through Markdown, dashes and casing', () => {
    expect(isQuoteInArticle('Fees on most rollups are now a fraction of mainnet - at least', article)).toBe(true);
    expect(isQuoteInArticle('fees on most rollups', article)).toBe(true);
    expect(isQuoteInArticle('See the docs for details', article)).toBe(true);
  });

  it('ignores wrapping quotes and edge punctuation', () => {
    expect(isQuoteInArticle('“Fees on most rollups are now a fraction of mainnet.”', article)).toBe(true);
  });

  it('accepts ellipses only when every segment appears in order', () => {
    expect(isQuoteInArticle('Fees on most rollups … at least in our tests', article)).toBe(true);
    expect(isQuoteInArticle('at least in our tests … Fees on most rollups', article)).toBe(false);
  });

  it('rejects paraphrases and empty quotes', () => {
    expect(isQuoteInArticle('Rollup fees are a small fraction of mainnet', article)).toBe(false);
    expect(isQuoteInArticle('  ', article)).toBe(false);
  });
});

describe('articleTitle', () => {
  it('prefers the first # heading', () => {
    expect(articleTitle('Intro line\n\n# The *Real* Title\n\nBody')).toBe('The Real Title');
  });
  it('falls back to the first line', () => {
    expect(articleTitle('\n\nFirst line here\nSecond')).toBe('First line here');
    expect(articleTitle('')).toBe('Untitled article');
  });
});

describe('placeholders', () => {
  it('splits and extracts [[ADD: …]] tokens', () => {
    const text = 'In [[ADD: month]], fees were [[ADD: fee and source]].';
    expect(extractPlaceholders(text)).toEqual(['[[ADD: month]]', '[[ADD: fee and source]]']);
    expect(splitAddTokens(text)).toEqual([
      { kind: 'text', value: 'In ' },
      { kind: 'add', value: '[[ADD: month]]' },
      { kind: 'text', value: ', fees were ' },
      { kind: 'add', value: '[[ADD: fee and source]]' },
      { kind: 'text', value: '.' },
    ]);
  });
});
