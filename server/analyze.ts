/**
 * The three Gemini-backed operations.
 */

import type { ArticleInput, LossSummary, PlatformsResult, RewriteResult, RubricResult } from '../shared/types';
import { generateJson } from './gemini';
import { normalizePlatforms, normalizeRewrite, normalizeRubric } from './normalize';
import {
  PLATFORM_SCHEMA,
  PLATFORM_SYSTEM,
  REWRITE_SCHEMA,
  REWRITE_SYSTEM,
  SCORE_SCHEMA,
  SCORE_SYSTEM,
  platformPrompt,
  rewritePrompt,
  scorePrompt,
} from './prompts';

const ANALYSIS_BUDGET_MS = 180_000;
const REWRITE_BUDGET_MS = 270_000;

export async function scoreArticle(input: ArticleInput, signal?: AbortSignal): Promise<RubricResult> {
  const started = Date.now();
  const { data, model } = await generateJson({
    system: SCORE_SYSTEM,
    prompt: scorePrompt(input),
    schema: SCORE_SCHEMA,
    timeoutMs: ANALYSIS_BUDGET_MS,
    signal,
  });
  return { ...normalizeRubric(data, input), model, durationMs: Date.now() - started };
}

export async function checkPlatforms(input: ArticleInput, signal?: AbortSignal): Promise<PlatformsResult> {
  const started = Date.now();
  const { data, model } = await generateJson({
    system: PLATFORM_SYSTEM,
    prompt: platformPrompt(input),
    schema: PLATFORM_SCHEMA,
    timeoutMs: ANALYSIS_BUDGET_MS,
    signal,
  });
  return { platforms: normalizePlatforms(data, input), model, durationMs: Date.now() - started };
}

export async function rewriteArticle(input: ArticleInput, losses: LossSummary[], signal?: AbortSignal): Promise<RewriteResult> {
  const started = Date.now();
  const { data, model } = await generateJson({
    system: REWRITE_SYSTEM,
    prompt: rewritePrompt(input, losses),
    schema: REWRITE_SCHEMA,
    timeoutMs: REWRITE_BUDGET_MS,
    signal,
  });
  return { ...normalizeRewrite(data, input), model, durationMs: Date.now() - started };
}
