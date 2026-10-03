import { describe, expect, it } from 'vitest';
import { CRITERIA, CRITERION_IDS, type CriterionId } from '../shared/rubric';
import { bandFor, clampScore, computePlatformScore, computeRubric } from '../shared/scoring';

const all = (score: number) => Object.fromEntries(CRITERION_IDS.map((id) => [id, score])) as Record<CriterionId, number>;
const lostOf = (r: ReturnType<typeof computeRubric>, id: CriterionId) => r.criteria.find((c) => c.id === id)!.lost;

describe('rubric', () => {
  it('has weights totalling 100', () => {
    expect(CRITERIA.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });
});

describe('computeRubric', () => {
  it('scores a perfect article 100 with nothing lost', () => {
    const r = computeRubric(all(10));
    expect(r.total).toBe(100);
    expect(r.band).toBe('highly_citable');
    expect(r.criteria.every((c) => c.lost === 0)).toBe(true);
  });

  it('loses every weight at zero', () => {
    const r = computeRubric(all(0));
    expect(r.total).toBe(0);
    expect(r.band).toBe('unlikely');
    for (const c of CRITERIA) expect(lostOf(r, c.id)).toBe(c.weight);
  });

  it('rounds the total half up and keeps lost points exact', () => {
    // Earned: 9 + 7 + 8 + 7.5 + 8 + 7 + 9 + 7 = 62.5 → 63
    const r = computeRubric({
      answer_first: 6, self_contained: 7, evidence: 4, originality: 5,
      quotability: 8, confidence: 7, structure: 9, trust: 7,
    });
    expect(r.total).toBe(63);
    expect(r.band).toBe('needs_work');
    expect(r.criteria.map((c) => c.lost)).toEqual([6, 3, 12, 7, 2, 3, 1, 3]);
  });

  it('gives remainders to the higher weight, then to rubric order', () => {
    // answer_first and originality both lose 4.5 (weight 15); total = 91, so 9 points are lost.
    const r = computeRubric({ ...all(10), answer_first: 7, originality: 7 });
    expect(r.total).toBe(91);
    expect(lostOf(r, 'answer_first')).toBe(5);
    expect(lostOf(r, 'originality')).toBe(4);
  });

  it('always loses exactly 100 − total, with each value within a point of the raw loss', () => {
    let seed = 42;
    const random = () => ((seed = (seed * 16807) % 2147483647) % 11);
    for (let i = 0; i < 2000; i++) {
      const scores = Object.fromEntries(CRITERION_IDS.map((id) => [id, random()])) as Record<CriterionId, number>;
      const r = computeRubric(scores);
      expect(r.criteria.reduce((s, c) => s + c.lost, 0)).toBe(100 - r.total);
      for (const c of r.criteria) {
        const raw = (c.weight * (10 - c.score)) / 10;
        expect(c.lost).toBeGreaterThanOrEqual(Math.floor(raw));
        expect(c.lost).toBeLessThanOrEqual(Math.ceil(raw));
      }
    }
  });

  it('clamps out-of-range model scores', () => {
    const r = computeRubric({ ...all(10), evidence: 14, trust: -3 });
    expect(r.criteria.find((c) => c.id === 'evidence')!.score).toBe(10);
    expect(r.criteria.find((c) => c.id === 'trust')!.score).toBe(0);
  });
});

describe('bandFor', () => {
  it.each([
    [0, 'unlikely'], [49, 'unlikely'], [50, 'needs_work'], [69, 'needs_work'],
    [70, 'strong'], [84, 'strong'], [85, 'highly_citable'], [100, 'highly_citable'],
  ])('%i → %s', (score, band) => {
    expect(bandFor(score)).toBe(band);
  });
});

describe('computePlatformScore', () => {
  it('is the factor mean × 10, rounded half up', () => {
    expect(computePlatformScore([7, 4, 8, 5])).toBe(60);
    expect(computePlatformScore([7, 7, 7, 8])).toBe(73);
    expect(computePlatformScore([10, 10, 10, 10])).toBe(100);
    expect(computePlatformScore([0, 0, 0, 1])).toBe(3);
    expect(computePlatformScore([])).toBe(0);
  });
});

describe('clampScore', () => {
  it('returns integers from 0 to 10', () => {
    expect(clampScore(11)).toBe(10);
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(7.6)).toBe(8);
    expect(clampScore('8')).toBe(8);
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(undefined)).toBe(0);
  });
});
