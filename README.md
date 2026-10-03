# CiteCheck

**Will AI cite this article?** Paste a draft and get:

- an **estimated citation score** from 0 to 100;
- **every point it loses and why**, each with a quote from your article, a fix and an example rewrite;
- **platform fit** for X, Paragraph, Medium, Substack and ChatGPT, each scored on four factors;
- an optional **rewrite** that is re-scored (a real before and after) and checked for facts it invented.

Scores are estimates from Google Gemini, not guarantees of citation.

## How scoring works

Gemini rates the article from 0 to 10 on eight criteria, using fixed anchors for 10, 8, 5 and 2 (see `shared/rubric.ts`). The server, not the model, turns those ratings into the score:

| Criterion | Weight |
|---|---|
| Evidence and specificity | 20 |
| Answer-first | 15 |
| Original contribution | 15 |
| Self-contained passages | 10 |
| Quotable statements | 10 |
| Confident wording | 10 |
| Structure | 10 |
| Trust signals | 10 |

- **Score** = Σ weight × rating / 10, rounded half up.
- **Points lost** per criterion are rounded so they always add up to exactly 100 − score.
- **Bands:** 85–100 Highly citable · 70–84 Strong · 50–69 Needs work · 0–49 Unlikely to be cited.
- **Quotes are verified:** a quote is shown only if it actually appears in your article.
- **Confident wording never rewards overclaiming:** confident claims without support lose points under Evidence.
- **Platform score** = the mean of its four factor ratings × 10.
- **Rewrite:** missing information becomes a `[[ADD: …]]` placeholder instead of being invented. Any number, link, quote or name in the rewrite that wasn't in your original is flagged under "Check before publishing".

## Run locally

Prerequisite: Node.js 20 or later.

1. Install dependencies: `npm install`
2. Create `.env.local` with your key: `GEMINI_API_KEY=your-key`
3. Start the app: `npm run dev`, then open http://localhost:3000

Other scripts:

- `npm test`: unit tests (no network, no API key needed)
- `npm run lint`: TypeScript type check
- `npm run build`, then `npm start` with `NODE_ENV=production`: production build and server

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | (required) | Gemini API key. In AI Studio it's injected from Secrets. |
| `GEMINI_MODEL` | `gemini-3.8-flash`, then `gemini-3.7-flash`, then `gemini-flash-latest` | Models to try first (comma-separated). Busy or unavailable models fall back to the next. |
| `RATE_LIMIT_PER_HOUR` | `40` | Gemini calls per visitor per hour. An analysis uses 2; a rewrite uses 3. |
| `DAILY_REQUEST_CAP` | `2000` | Gemini calls per day for the whole server. |
| `TRUST_PROXY_HOPS` | `1` | Proxies in front of the app, used to find each visitor's IP. |
| `PORT` | `3000` | Port to listen on. |

Usage limits are kept in memory: they reset when the server restarts.

## Project layout

```
shared/   rubric, scoring math, text helpers, new-fact detection, API types (used by server, UI and tests)
server/   Gemini client (retries, fallback, timeouts), prompts and schemas, validation, usage limits
src/      React UI
tests/    unit tests
```

## Privacy

Articles are sent to Google Gemini to be scored. CiteCheck doesn't store or log them. The draft is kept in the browser tab only (session storage), so it survives a refresh but not closing the tab.
