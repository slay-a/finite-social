/**
 * OpenAI API key — loaded from EAS Secrets at build time so it is never
 * committed to source control.
 *
 * To set it once:
 *   eas secret:create --scope project --name OPENAI_API_KEY --value sk-...
 *
 * For local dev, create a file called .env.local at the project root:
 *   OPENAI_API_KEY=sk-...
 * then run:  npx expo start
 *
 * Cost estimate (gpt-4o-mini, $0.15/1M input tokens):
 *   Smart summaries:  ~50 tokens × 20 articles  ≈ $0.00015 per load
 *   Explain feature:  ~300 tokens per tap        ≈ $0.000045 per explain
 *   → 10,000 DAU ≈ $1–2/day total
 */
export const OPENAI_API_KEY: string =
  process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

/** Model for smart summaries — fast and very cheap */
export const SUMMARY_MODEL = 'gpt-4o-mini';

/** Model for in-app Explain chat */
export const EXPLAIN_MODEL = 'gpt-4o-mini';

/** Max articles to enhance per feed load (cached after first run) */
export const MAX_ENHANCE_PER_LOAD = 20;
