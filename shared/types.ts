/**
 * API contract between the server and the UI.
 * The server sends finished view models: totals, bands and lost points are
 * computed server-side, and only verified quotes are ever sent.
 */

import type { CriterionId, PlatformId } from './rubric';
import type { Band } from './scoring';
import type { NewFactFlag } from './verify';

export interface ArticleInput {
  article: string;
  author?: string;
  topic?: string;
}

export interface CriterionView {
  id: CriterionId;
  label: string;
  weight: number;
  score: number;
  lost: number;
  /** Why points were lost (empty at 10/10). */
  issue: string;
  fix: string;
  /** May contain [[ADD: …]] placeholders. */
  exampleRewrite: string;
  /** What works (only at 10/10). */
  strength: string;
  /** A verbatim excerpt from the article, present only when it was found in the article. */
  quote: string | null;
  /** True when the model supplied a quote that couldn't be matched to the article. */
  quoteUnverified: boolean;
}

export interface RubricResult {
  total: number;
  band: Band;
  summary: string;
  criteria: CriterionView[];
  quotes: { supplied: number; verified: number };
  wordCount: number;
  model: string;
  durationMs: number;
}

export interface PlatformFactorView {
  id: string;
  label: string;
  score: number;
  reason: string;
}

export interface PlatformIssueView {
  quote: string | null;
  quoteUnverified: boolean;
  problem: string;
  fix: string;
}

export interface PlatformView {
  id: PlatformId;
  label: string;
  score: number;
  band: Band;
  verdict: string;
  factors: PlatformFactorView[];
  whatWorks: string[];
  issues: PlatformIssueView[];
  /** ChatGPT only. */
  likelyQuestions: string[];
}

export interface PlatformsResult {
  platforms: PlatformView[];
  model: string;
  durationMs: number;
}

export interface LossSummary {
  criterion: CriterionId;
  lost: number;
  issue: string;
  fix: string;
}

export interface RewriteRequest extends ArticleInput {
  losses: LossSummary[];
}

export interface RewriteChange {
  criterion: CriterionId;
  label: string;
  change: string;
}

export interface RewriteResult {
  markdown: string;
  changes: RewriteChange[];
  /** Numbers, links, quotes and names that weren't in the original. */
  flags: NewFactFlag[];
  /** Every [[ADD: …]] the writer still has to fill, in order. */
  placeholders: string[];
  wordCount: number;
  model: string;
  durationMs: number;
}

export type ErrorCode =
  | 'BAD_INPUT'
  | 'RATE_LIMITED'
  | 'DAILY_CAP'
  | 'NOT_CONFIGURED'
  | 'AUTH'
  | 'MODEL_UNAVAILABLE'
  | 'BUSY'
  | 'BLOCKED'
  | 'TRUNCATED'
  | 'INVALID_OUTPUT'
  | 'TIMEOUT'
  | 'SERVER'
  | 'NETWORK';

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; retryable: boolean };
}

export interface HealthResult {
  ok: true;
  geminiConfigured: boolean;
  model: string;
}
