/**
 * Scoring math. Pure functions: the model only supplies 0–10 scores per
 * criterion or factor; every total, band and lost-point value is computed here.
 */

import { CRITERIA, type CriterionId } from './rubric';

export type Band = 'highly_citable' | 'strong' | 'needs_work' | 'unlikely';

/** 85–100 Highly citable · 70–84 Strong · 50–69 Needs work · 0–49 Unlikely to be cited */
export function bandFor(score: number): Band {
  if (score >= 85) return 'highly_citable';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'needs_work';
  return 'unlikely';
}

/** Clamp to an integer in [0, 10]. Anything that isn't a finite number becomes 0. */
export function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(0, Math.round(n)));
}

export interface CriterionPoints {
  id: CriterionId;
  weight: number;
  score: number;
  /** Whole points lost; the values across all criteria sum to exactly 100 − total. */
  lost: number;
}

export interface RubricPoints {
  total: number;
  band: Band;
  criteria: CriterionPoints[];
}

/**
 * total = round_half_up(Σ weight × score / 10)
 * lost  = weight × (10 − score) / 10, rounded with the largest-remainder method
 *         so the lost points sum to exactly 100 − total.
 *         Ties go to the higher weight, then to rubric order.
 *
 * Works in tenths of a point so there is no floating-point drift.
 */
export function computeRubric(scores: Record<CriterionId, number>): RubricPoints {
  const rows = CRITERIA.map((c, order) => {
    const score = clampScore(scores[c.id]);
    const lostTenths = c.weight * (10 - score);
    return { id: c.id, weight: c.weight, score, order, lostTenths, lost: Math.floor(lostTenths / 10) };
  });

  const earnedTenths = rows.reduce((sum, r) => sum + r.weight * r.score, 0);
  const total = Math.floor((earnedTenths + 5) / 10);

  let remaining = 100 - total - rows.reduce((sum, r) => sum + r.lost, 0);
  const byRemainder = [...rows]
    .filter((r) => r.lostTenths % 10 > 0)
    .sort((a, b) => b.lostTenths % 10 - a.lostTenths % 10 || b.weight - a.weight || a.order - b.order);
  for (const r of byRemainder) {
    if (remaining <= 0) break;
    r.lost += 1;
    remaining -= 1;
  }

  return {
    total,
    band: bandFor(total),
    criteria: rows.map(({ id, weight, score, lost }) => ({ id, weight, score, lost })),
  };
}

/** Platform score = round_half_up(mean of the four 0–10 factors × 10). */
export function computePlatformScore(factorScores: number[]): number {
  if (factorScores.length === 0) return 0;
  const sum = factorScores.reduce((s, v) => s + clampScore(v), 0);
  return Math.floor((sum * 100 + factorScores.length * 5) / (factorScores.length * 10));
}
