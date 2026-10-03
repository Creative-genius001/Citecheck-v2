import { describe, expect, it } from 'vitest';
import { CRITERION_IDS, PLATFORMS } from '../shared/rubric';
import { normalizePlatforms, normalizeRewrite, normalizeRubric } from '../server/normalize';

const article = `# Choosing a rollup

I think rollups might be cheaper. Fees on most rollups are now a fraction of mainnet.`;

function criterion(score: number, quote = '') {
  return { score, evidence_quote: quote, issue: 'Because.', fix: 'Do this.', example_rewrite: 'Better [[ADD: source]].', strength: 'Great.' };
}

function rubricRaw(overrides: Record<string, unknown> = {}) {
  return { criteria: { ...Object.fromEntries(CRITERION_IDS.map((id) => [id, criterion(10)])), ...overrides }, summary: ' Solid. ' };
}

describe('normalizeRubric', () => {
  it('computes totals and keeps only verified quotes', () => {
    const result = normalizeRubric(
      rubricRaw({
        evidence: criterion(4, 'Fees on most rollups are now a fraction of mainnet'),
        confidence: criterion(6, 'rollups are definitely cheaper'),
      }),
      { article },
    );
    expect(result.total).toBe(84); // 100 − 12 (evidence) − 4 (confidence)
    expect(result.band).toBe('strong');
    expect(result.summary).toBe('Solid.');

    const evidence = result.criteria.find((c) => c.id === 'evidence')!;
    expect(evidence.lost).toBe(12);
    expect(evidence.quote).toBe('Fees on most rollups are now a fraction of mainnet');
    expect(evidence.quoteUnverified).toBe(false);

    const confidence = result.criteria.find((c) => c.id === 'confidence')!;
    expect(confidence.quote).toBeNull();
    expect(confidence.quoteUnverified).toBe(true);

    expect(result.quotes).toEqual({ supplied: 2, verified: 1 });
  });

  it('clears issue fields at 10/10 and keeps the strength', () => {
    const result = normalizeRubric(rubricRaw(), { article });
    const first = result.criteria[0];
    expect(first).toMatchObject({ score: 10, lost: 0, issue: '', fix: '', exampleRewrite: '', quote: null, strength: 'Great.' });
  });

  it('rejects output missing a criterion', () => {
    const raw = rubricRaw();
    delete (raw.criteria as Record<string, unknown>).trust;
    expect(() => normalizeRubric(raw, { article })).toThrowError(expect.objectContaining({ code: 'INVALID_OUTPUT' }));
    expect(() => normalizeRubric('nonsense', { article })).toThrowError(expect.objectContaining({ code: 'INVALID_OUTPUT' }));
  });
});

describe('normalizePlatforms', () => {
  const raw = Object.fromEntries(
    PLATFORMS.map((p) => [
      p.id,
      {
        factors: Object.fromEntries(p.factors.map((f, i) => [f.id, { score: [7, 4, 8, 5][i], reason: `${f.label} reason` }])),
        verdict: 'Fits.',
        what_works: ['One', 'Two', 'Three', 'Four'],
        issues: [{ evidence_quote: 'I think rollups might be cheaper', problem: 'Hedged.', fix: 'Commit.' }],
        likely_questions: ['Which rollup is cheapest?'],
      },
    ]),
  );

  it('scores each platform and trims lists', () => {
    const platforms = normalizePlatforms(raw, { article });
    expect(platforms.map((p) => p.id)).toEqual(['x', 'paragraph', 'medium', 'substack', 'chatgpt']);
    for (const p of platforms) {
      expect(p.score).toBe(60);
      expect(p.band).toBe('needs_work');
      expect(p.whatWorks).toHaveLength(3);
      expect(p.issues[0].quote).toBe('I think rollups might be cheaper');
    }
    expect(platforms.find((p) => p.id === 'chatgpt')!.likelyQuestions).toEqual(['Which rollup is cheapest?']);
    expect(platforms.find((p) => p.id === 'x')!.likelyQuestions).toEqual([]);
  });
});

describe('normalizeRewrite', () => {
  it('flags new facts and collects placeholders', () => {
    const markdown = `# Choosing a rollup\n\nFees on most rollups are now a fraction of mainnet: about 2% of the cost in [[ADD: month and year]]. ${'Word '.repeat(40)}`;
    const result = normalizeRewrite({ rewritten_markdown: markdown, changes: [{ criterion: 'evidence', change: 'Added a figure.' }, { criterion: 'bogus', change: 'x' }] }, { article });
    expect(result.placeholders).toEqual(['[[ADD: month and year]]']);
    expect(result.flags.map((f) => f.value)).toContain('2%');
    expect(result.changes).toEqual([{ criterion: 'evidence', label: 'Evidence and specificity', change: 'Added a figure.' }]);
  });

  it('rejects an empty rewrite', () => {
    expect(() => normalizeRewrite({ rewritten_markdown: 'Too short.', changes: [] }, { article })).toThrowError(
      expect.objectContaining({ code: 'INVALID_OUTPUT' }),
    );
  });
});
