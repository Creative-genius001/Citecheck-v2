/**
 * Gemini client: structured JSON output, retries with backoff, model fallback,
 * an overall time budget, and cancellation when the browser disconnects.
 */

import { ApiError, GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { AppError, errors } from './errors';

/** Newest first. GEMINI_MODEL (comma-separated) is tried before these. */
const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];

/** Fixed seed: Gemini makes a best effort to return the same output for the same input. */
const SEED = 7;

const RETRIES_PER_MODEL = 2;
const BLOCK_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);

/** Thrown when the browser went away; the route sends nothing. */
export class Cancelled extends Error {
  constructor() {
    super('Request cancelled by the client');
    this.name = 'Cancelled';
  }
}

let client: GoogleGenAI | null = null;

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function isGeminiConfigured(): boolean {
  return Boolean(apiKey());
}

export function configuredModels(): string[] {
  const fromEnv = (process.env.GEMINI_MODEL ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  return [...new Set([...fromEnv, ...DEFAULT_MODELS])];
}

function getClient(): GoogleGenAI {
  const key = apiKey();
  if (!key) throw errors.notConfigured();
  client ??= new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  return client;
}

export interface JsonRequest {
  system: string;
  prompt: string;
  schema: object;
  /** Budget for the whole operation, including retries. */
  timeoutMs: number;
  /** Aborted when the browser disconnects. */
  signal?: AbortSignal;
}

export async function generateJson(req: JsonRequest): Promise<{ data: unknown; model: string }> {
  const gemini = getClient();
  const deadline = AbortSignal.timeout(req.timeoutMs);
  const signal = req.signal ? anySignal([req.signal, deadline]) : deadline;

  let lastError: AppError = errors.busy();
  let unavailableModels = 0;
  let authFailures = 0;
  const models = configuredModels();

  for (const model of models) {
    let useSeed = true;
    for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt++) {
      if (req.signal?.aborted) throw new Cancelled();
      if (deadline.aborted) throw errors.timeout();
      try {
        const response = await gemini.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
          config: {
            systemInstruction: req.system,
            responseMimeType: 'application/json',
            responseJsonSchema: req.schema,
            ...(useSeed ? { seed: SEED } : {}),
            abortSignal: signal,
          },
        });
        return { data: parseJsonResponse(response), model };
      } catch (err) {
        if (req.signal?.aborted) throw new Cancelled();
        if (deadline.aborted) throw errors.timeout();

        if (err instanceof AppError) {
          // Unreadable output is usually a one-off; blocked or truncated output won't change on retry.
          if (err.code === 'INVALID_OUTPUT' && attempt < RETRIES_PER_MODEL) {
            lastError = err;
            continue;
          }
          throw err;
        }

        const status = err instanceof ApiError ? err.status : undefined;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[gemini] ${model} attempt ${attempt + 1} failed (${status ?? 'network'}): ${message.slice(0, 300)}`);

        if (status === 400 && /api key/i.test(message)) throw errors.auth();
        if (status === 400 && useSeed) {
          // Retry once without the optional seed in case this model rejects it.
          useSeed = false;
          attempt--;
          continue;
        }
        if (status === 401) throw errors.auth();
        if (status === 403) {
          authFailures++;
          break;
        }
        if (status === 404) {
          unavailableModels++;
          break;
        }
        if (status === 400) {
          lastError = errors.server();
          break;
        }

        // 429, 5xx and network errors: back off, then retry or move to the next model.
        lastError = errors.busy();
        if (attempt < RETRIES_PER_MODEL) await sleep(800 * 2 ** attempt + Math.random() * 400, signal);
      }
    }
  }

  if (authFailures === models.length) throw errors.auth();
  if (unavailableModels + authFailures === models.length) throw errors.modelUnavailable();
  throw lastError;
}

function parseJsonResponse(response: GenerateContentResponse): unknown {
  if (response.promptFeedback?.blockReason) throw errors.blocked();
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') throw errors.truncated();
  if (finishReason && BLOCK_REASONS.has(finishReason)) throw errors.blocked();

  const text = response.text;
  if (!text) throw errors.invalidOutput();
  try {
    return JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
  } catch {
    throw errors.invalidOutput();
  }
}

/** AbortSignal.any needs Node 20.3+; fall back to wiring the signals by hand. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });
}
