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

  let text: string;
  try {
    text = await res.text();
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiFailure('NETWORK', 'The connection to the server dropped. Try again.', true);
  }
  return parseResponse<T>(res.status, res.headers.get('Content-Type') ?? '', text);
}

/**
 * Successful AI requests stream NDJSON: blank keep-alive lines, then one line
 * {"ok":true,"result":…} or {"ok":false,"error":…}. Other replies are plain JSON.
 */
export function parseResponse<T>(status: number, contentType: string, text: string): T {
  if (contentType.includes('application/x-ndjson')) {
    const last = text.trim().split('\n').pop();
    let line: { ok?: boolean; result?: T } & Partial<ApiErrorBody> = {};
    try {
      line = last ? JSON.parse(last) : {};
    } catch {
      // Falls through to the "cut off" error below.
    }
    if (line.ok === true && line.result !== undefined) return line.result;
    if (line.error?.code && line.error.message) throw new ApiFailure(line.error.code, line.error.message, line.error.retryable);
    throw new ApiFailure('NETWORK', 'The connection to the server was cut off before the result arrived. Try again.', true);
  }

  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Not JSON: usually a proxy's own page, e.g. a timeout or "Starting server" page.
    if (/^\s*</.test(text)) {
      throw new ApiFailure('TIMEOUT', 'The server took too long to respond, so the connection was closed. Try again.', true);
    }
  }
  if (status >= 200 && status < 300 && data) return data as T;

  const error = (data as ApiErrorBody | null)?.error;
  if (error?.code && error.message) throw new ApiFailure(error.code, error.message, error.retryable);
  throw new ApiFailure('SERVER', `The server returned an unexpected response (${status}). Try again.`, true);
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
