import type { ErrorCode } from '../shared/types';

/** An error that is safe to show to the user, with the HTTP status to send. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  badInput: (message: string) => new AppError('BAD_INPUT', 400, message),
  notConfigured: () =>
    new AppError('NOT_CONFIGURED', 503, 'Gemini isn’t set up on this server. Add GEMINI_API_KEY to the server environment and restart it.'),
  auth: () => new AppError('AUTH', 502, 'Gemini rejected the server’s API key. Check GEMINI_API_KEY.'),
  modelUnavailable: () =>
    new AppError('MODEL_UNAVAILABLE', 502, 'None of the configured Gemini models are available to this API key.'),
  busy: () => new AppError('BUSY', 503, 'Gemini is busy right now. Try again in a minute.', true),
  blocked: () =>
    new AppError('BLOCKED', 422, 'Gemini declined to process this article (safety filter). Try removing any sensitive content.'),
  truncated: () =>
    new AppError('TRUNCATED', 502, 'Gemini’s response was cut off before it finished. Try again, or shorten the article.', true),
  invalidOutput: () => new AppError('INVALID_OUTPUT', 502, 'Gemini returned a response CiteCheck couldn’t read. Try again.', true),
  timeout: () => new AppError('TIMEOUT', 504, 'Gemini took too long to respond. Try again.', true),
  rateLimited: (retryAfterSeconds: number) =>
    new AppError(
      'RATE_LIMITED',
      429,
      `You’ve reached the limit of analyses for now. Try again in ${formatWait(retryAfterSeconds)}.`,
      true,
    ),
  dailyCap: () => new AppError('DAILY_CAP', 429, 'CiteCheck has reached its daily usage limit. Try again tomorrow.'),
  server: () => new AppError('SERVER', 500, 'Something went wrong on the server. Try again.', true),
};

function formatWait(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.ceil(seconds))} seconds`;
  return `${Math.ceil(seconds / 60)} minutes`;
}
