/**
 * CiteCheck server: Express API + Vite middleware (dev) or static files (production).
 */

import './server/loadEnv';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type { ApiErrorBody, HealthResult } from './shared/types';
import { checkPlatforms, rewriteArticle, scoreArticle } from './server/analyze';
import { AppError, errors } from './server/errors';
import { Cancelled, configuredModels, isGeminiConfigured } from './server/gemini';
import { parseArticleInput, parseLosses } from './server/input';
import { createRateLimiter, limitsFromEnv } from './server/rateLimit';

const limiter = createRateLimiter(limitsFromEnv());

function sendError(res: Response, err: AppError) {
  const body: ApiErrorBody = { error: { code: err.code, message: err.message, retryable: err.retryable } };
  res.status(err.status).json(body);
}

const HEARTBEAT_MS = 5000;

/**
 * Wraps a Gemini-backed route: validates input before anything is counted or
 * spent, applies the usage limits, and cancels the Gemini call if the browser
 * disconnects (Cancel in the UI, or a closed tab).
 *
 * Gemini calls can take longer than a proxy is willing to wait for a reply
 * (AI Studio's preview gives up after 30 s). So once the input is accepted, the
 * response starts straight away as NDJSON: a blank line every few seconds keeps
 * the connection alive, and the last line is {"ok":true,"result":…} or
 * {"ok":false,"error":…}. Input and limit errors still use normal status codes.
 */
function aiRoute<T>(parse: (body: unknown) => T, run: (input: T, signal: AbortSignal) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });

    let input: T;
    try {
      input = parse(req.body);
      if (!isGeminiConfigured()) throw errors.notConfigured();
      limiter.take(req.ip ?? 'unknown');
    } catch (err) {
      sendError(res, err instanceof AppError ? err : errors.server());
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('\n');
    const heartbeat = setInterval(() => res.write('\n'), HEARTBEAT_MS);

    try {
      const result = await run(input, controller.signal);
      res.end(`${JSON.stringify({ ok: true, result })}\n`);
    } catch (err) {
      if (err instanceof Cancelled || controller.signal.aborted) return;
      if (!(err instanceof AppError)) console.error(`[api] ${req.path} failed:`, err);
      const e = err instanceof AppError ? err : errors.server();
      const body: ApiErrorBody = { error: { code: e.code, message: e.message, retryable: e.retryable } };
      res.end(`${JSON.stringify({ ok: false, ...body })}\n`);
    } finally {
      clearInterval(heartbeat);
    }
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  // Behind AI Studio / Cloud Run the client IP arrives in X-Forwarded-For.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use('/api', express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const body: HealthResult = { ok: true, geminiConfigured: isGeminiConfigured(), model: configuredModels()[0] };
    res.json(body);
  });

  app.post('/api/score', aiRoute(parseArticleInput, (input, signal) => scoreArticle(input, signal)));
  app.post('/api/platforms', aiRoute(parseArticleInput, (input, signal) => checkPlatforms(input, signal)));
  app.post(
    '/api/rewrite',
    aiRoute(
      (body) => ({ input: parseArticleInput(body), losses: parseLosses((body as { losses?: unknown } | undefined)?.losses) }),
      ({ input, losses }, signal) => rewriteArticle(input, losses, signal),
    ),
  );

  app.use('/api', (_req, res) => sendError(res, new AppError('BAD_INPUT', 404, 'Unknown API route.')));

  // Malformed or oversized JSON bodies.
  app.use('/api', (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const type = (err as { type?: string } | null)?.type;
    if (type === 'entity.too.large') return sendError(res, errors.badInput('The article is too large to send.'));
    if (type === 'entity.parse.failed') return sendError(res, errors.badInput('The request body isn’t valid JSON.'));
    next(err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CiteCheck running on http://localhost:${port}`);
    if (!isGeminiConfigured()) console.warn('GEMINI_API_KEY is not set: analyses will fail until it is.');
  });
}

startServer().catch((err) => {
  console.error('Failed to start CiteCheck:', err);
  process.exit(1);
});
