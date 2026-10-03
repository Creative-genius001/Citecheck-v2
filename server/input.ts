/**
 * Request body validation. Limits match the editor's so the server never
 * spends a Gemini call on input the UI would have refused.
 */

import { CRITERION_IDS, type CriterionId } from '../shared/rubric';
import { LIMITS, countWords } from '../shared/text';
import type { ArticleInput, LossSummary } from '../shared/types';
import { errors } from './errors';

function optionalText(value: unknown, max: number, name: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw errors.badInput(`${name} must be text.`);
  if (value.length > max) throw errors.badInput(`${name} must be ${max} characters or fewer.`);
  return value.trim() || undefined;
}

export function parseArticleInput(body: unknown): ArticleInput {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (typeof b.article !== 'string' || !b.article.trim()) throw errors.badInput('Paste an article to analyze.');
  if (b.article.length > LIMITS.maxChars) throw errors.badInput('The article is too long to analyze.');

  const words = countWords(b.article);
  if (words < LIMITS.minWords) throw errors.badInput(`The article needs at least ${LIMITS.minWords} words.`);
  if (words > LIMITS.maxWords) {
    throw errors.badInput(`Split this into parts: CiteCheck analyzes up to ${LIMITS.maxWords.toLocaleString('en-US')} words.`);
  }

  return {
    article: b.article,
    author: optionalText(b.author, LIMITS.maxAuthor, 'About the author'),
    topic: optionalText(b.topic, LIMITS.maxTopic, 'Target question or topic'),
  };
}

export function parseLosses(value: unknown): LossSummary[] {
  if (!Array.isArray(value) || value.length > CRITERION_IDS.length) throw errors.badInput('Invalid points-lost summary.');
  return value.map((item) => {
    const l = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const lost = Number(l.lost);
    if (!CRITERION_IDS.includes(l.criterion as CriterionId) || !Number.isInteger(lost) || lost < 0 || lost > 100) {
      throw errors.badInput('Invalid points-lost summary.');
    }
    return {
      criterion: l.criterion as CriterionId,
      lost,
      issue: typeof l.issue === 'string' ? l.issue.slice(0, 1000) : '',
      fix: typeof l.fix === 'string' ? l.fix.slice(0, 1000) : '',
    };
  });
}
