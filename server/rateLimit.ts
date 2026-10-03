/**
 * In-memory usage limits for the Gemini-backed routes. Every call is paid from
 * the server's API key, so there are two limits:
 * - per visitor (by IP): a sliding one-hour window;
 * - for the whole server: a daily cap, which also bounds spend if IPs are spoofed.
 * Counts live in memory: they reset on restart and aren't shared between instances.
 */

import { errors } from './errors';

const HOUR_MS = 60 * 60 * 1000;

export interface RateLimiterOptions {
  perHour: number;
  perDay: number;
  now?: () => number;
}

export function createRateLimiter({ perHour, perDay, now = Date.now }: RateLimiterOptions) {
  const hits = new Map<string, number[]>();
  let day = '';
  let dayCount = 0;

  const sweep = setInterval(() => {
    const cutoff = now() - HOUR_MS;
    for (const [key, times] of hits) {
      if (times[times.length - 1] <= cutoff) hits.delete(key);
    }
  }, 10 * 60 * 1000);
  sweep.unref?.();

  return {
    /** Records one call for `key`, or throws a 429 AppError. */
    take(key: string): void {
      const t = now();
      const today = new Date(t).toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        dayCount = 0;
      }
      if (dayCount >= perDay) throw errors.dailyCap();

      const recent = (hits.get(key) ?? []).filter((time) => time > t - HOUR_MS);
      if (recent.length >= perHour) {
        hits.set(key, recent);
        throw errors.rateLimited((recent[0] + HOUR_MS - t) / 1000);
      }
      recent.push(t);
      hits.set(key, recent);
      dayCount++;
    },
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** An analysis uses 2 calls (score + platforms); a rewrite uses 3 (rewrite + re-score). */
export function limitsFromEnv(): RateLimiterOptions {
  return {
    perHour: positiveInt(process.env.RATE_LIMIT_PER_HOUR, 40),
    perDay: positiveInt(process.env.DAILY_REQUEST_CAP, 2000),
  };
}
