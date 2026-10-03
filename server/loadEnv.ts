/**
 * Loads .env.local, then .env, for local development. Imported first in server.ts
 * so later modules see the values. Variables already set (for example by
 * AI Studio's runtime) are never overridden.
 */

import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });
