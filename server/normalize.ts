/**
 * Turns Gemini's raw JSON into the view models the UI renders.
 * The model is never trusted: scores are clamped, totals are computed here,
 * quotes are checked against the article, and anything malformed is rejected.
 */

import { CRITERIA, CRITERION_IDS, PLATFORMS, criterionById, type CriterionId } from '../shared/rubric';
import { bandFor, computePlatformScore, computeRubric, clampScore } from '../shared/scoring';
import { countWords, extractPlaceholders, isQuoteInArticle, normalizeForMatch } from '../shared/text';
import type {
  ArticleInput,
  CriterionView,
  PlatformIssueView,
  PlatformView,
  RewriteChange,
  RewriteResult,
  RubricResult,
} from '../shared/types';
import { findNewFacts } from '../shared/verify';
import { errors } from './errors';

type Json = Record<string, unknown>;

function record(value: unknown): Json | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

function text(value: unknown, max = 1200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textList(value: unknown, max: number): string[] {
  return list(value).map((v) => text(v, 400)).filter(Boolean).slice(0, max);
}

/** Strips quote marks the model sometimes wraps around an excerpt. */
function cleanQuote(quote: string): string {
  return quote.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
}

function checkQuote(raw: unknown, normalizedArticle: string): { quote: string | null; quoteUnverified: boolean } {
  const quote = cleanQuote(text(raw, 600));
  if (!quote) return { quote: null, quoteUnverified: false };
  return isQuoteInArticle(quote, normalizedArticle)
    ? { quote, quoteUnverified: false }
    : { quote: null, quoteUnverified: true };
}

export function normalizeRubric(raw: unknown, input: ArticleInput): Omit<RubricResult, 'model' | 'durationMs'> {
  const root = record(raw);
  const criteria = record(root?.criteria);
  if (!root || !criteria) throw errors.invalidOutput();

  const normalizedArticle = normalizeForMatch(input.article);
  const scores = {} as Record<CriterionId, number>;
  const details = new Map<CriterionId, Omit<CriterionView, 'lost' | 'weight' | 'label' | 'id' | 'score'>>();
  let supplied = 0;
  let verified = 0;

  for (const c of CRITERIA) {
    const r = record(criteria[c.id]);
    if (!r) throw errors.invalidOutput();
    const score = clampScore(r.score);
    scores[c.id] = score;

    if (score === 10) {
      details.set(c.id, {
        issue: '',
        fix: '',
        exampleRewrite: '',
        strength: text(r.strength) || 'Full marks on this criterion.',
        quote: null,
        quoteUnverified: false,
      });
      continue;
    }

    const quote = checkQuote(r.evidence_quote, normalizedArticle);
    if (quote.quote || quote.quoteUnverified) supplied++;
    if (quote.quote) verified++;
    details.set(c.id, {
      issue: text(r.issue) || 'No explanation was returned for this criterion.',
      fix: text(r.fix),
      exampleRewrite: text(r.example_rewrite, 2000),
      strength: '',
      ...quote,
    });
  }

  const points = computeRubric(scores);
  return {
    total: points.total,
    band: points.band,
    summary: text(root.summary, 600),
    criteria: points.criteria.map((p) => ({
      id: p.id,
      label: criterionById(p.id).label,
      weight: p.weight,
      score: p.score,
      lost: p.lost,
      ...details.get(p.id)!,
    })),
    quotes: { supplied, verified },
    wordCount: countWords(input.article),
  };
}

export function normalizePlatforms(raw: unknown, input: ArticleInput): PlatformView[] {
  const root = record(raw);
  if (!root) throw errors.invalidOutput();
  const normalizedArticle = normalizeForMatch(input.article);

  return PLATFORMS.map((p) => {
    const r = record(root[p.id]);
    const factorsRaw = record(r?.factors);
    if (!r || !factorsRaw) throw errors.invalidOutput();

    const factors = p.factors.map((f) => {
      const fr = record(factorsRaw[f.id]);
      if (!fr) throw errors.invalidOutput();
      return { id: f.id, label: f.label, score: clampScore(fr.score), reason: text(fr.reason, 400) };
    });
    const score = computePlatformScore(factors.map((f) => f.score));

    const issues: PlatformIssueView[] = list(r.issues)
      .map(record)
      .filter((i): i is Json => i !== null)
      .map((i) => ({ ...checkQuote(i.evidence_quote, normalizedArticle), problem: text(i.problem, 600), fix: text(i.fix, 600) }))
      .filter((i) => i.problem)
      .slice(0, 4);

    return {
      id: p.id,
      label: p.label,
      score,
      band: bandFor(score),
      verdict: text(r.verdict, 400),
      factors,
      whatWorks: textList(r.what_works, 3),
      issues,
      likelyQuestions: p.hasLikelyQuestions ? textList(r.likely_questions, 5) : [],
    };
  });
}

export function normalizeRewrite(raw: unknown, input: ArticleInput): Omit<RewriteResult, 'model' | 'durationMs'> {
  const root = record(raw);
  const markdown = typeof root?.rewritten_markdown === 'string' ? root.rewritten_markdown.trim() : '';
  if (!root || countWords(markdown) < 30) throw errors.invalidOutput();

  const changes: RewriteChange[] = list(root.changes)
    .map(record)
    .filter((c): c is Json => c !== null && CRITERION_IDS.includes(c.criterion as CriterionId) && Boolean(text(c.change)))
    .slice(0, 12)
    .map((c) => {
      const criterion = c.criterion as CriterionId;
      return { criterion, label: criterionById(criterion).label, change: text(c.change, 400) };
    });

  return {
    markdown,
    changes,
    flags: findNewFacts(input.article, markdown),
    placeholders: extractPlaceholders(markdown),
    wordCount: countWords(markdown),
  };
}
