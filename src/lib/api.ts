/**
 * Typed client for the CiteCheck API. Every failure becomes an ApiFailure
 * with a message that is safe to show.
 */

import type {
  ApiErrorBody,
  ArticleInput,
  ErrorCode,
  HealthResult,
  LossSummary,
  PlatformsResult,
  RewriteResult,
  RubricResult,
} from '../../shared/types';

export class ApiFailure extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiFailure('NETWORK', 'Couldn’t reach the CiteCheck server. Check your connection and try again.', true);
  }

  const data: unknown = await res.json().catch(() => null);
  if (res.ok && data) return data as T;

  const error = (data as ApiErrorBody | null)?.error;
  if (error?.code && error.message) throw new ApiFailure(error.code, error.message, error.retryable);
  throw new ApiFailure('SERVER', `The server returned an unexpected response (${res.status}). Try again.`, true);
}

function input({ article, author, topic }: ArticleInput): ArticleInput {
  return { article, author: author?.trim() || undefined, topic: topic?.trim() || undefined };
}

export const api = {
  score: (body: ArticleInput, signal?: AbortSignal) => post<RubricResult>('/api/score', input(body), signal),
  platforms: (body: ArticleInput, signal?: AbortSignal) => post<PlatformsResult>('/api/platforms', input(body), signal),
  rewrite: (body: ArticleInput, losses: LossSummary[], signal?: AbortSignal) =>
    post<RewriteResult>('/api/rewrite', { ...input(body), losses }, signal),
  health: async (): Promise<HealthResult | null> => {
    try {
      const res = await fetch('/api/health');
      return res.ok ? ((await res.json()) as HealthResult) : null;
    } catch {
      return null;
    }
  },
};
