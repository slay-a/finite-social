import { Article } from '../types';
import { OPENAI_API_KEY, SUMMARY_MODEL, EXPLAIN_MODEL, MAX_ENHANCE_PER_LOAD } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'finitesocial:summary:';

// ─── Cache ────────────────────────────────────────────────────────────────────

async function getCached(id: string): Promise<string | null> {
  try { return await AsyncStorage.getItem(CACHE_PREFIX + id); }
  catch { return null; }
}

async function setCache(id: string, text: string): Promise<void> {
  try { await AsyncStorage.setItem(CACHE_PREFIX + id, text); }
  catch {}
}

// ─── OpenAI call ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callOpenAI(
  messages: ChatMessage[],
  model = EXPLAIN_MODEL,
  maxTokens = 512
): Promise<string> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('YOUR_KEY')) {
    throw new Error('NO_KEY');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

// ─── Smart titles + summaries (background, developer key) ────────────────────

export interface EnhancedContent {
  title: string;
  summary: string;
}

const TITLE_CACHE_PREFIX = 'finitesocial:title:';

async function getCachedTitle(id: string): Promise<string | null> {
  try { return await AsyncStorage.getItem(TITLE_CACHE_PREFIX + id); }
  catch { return null; }
}
async function setCacheTitle(id: string, text: string): Promise<void> {
  try { await AsyncStorage.setItem(TITLE_CACHE_PREFIX + id, text); }
  catch {}
}

async function enhanceOne(article: Article): Promise<EnhancedContent | null> {
  // Return from cache immediately if both are cached
  const [cachedSummary, cachedTitle] = await Promise.all([
    getCached(article.id),
    getCachedTitle(article.id),
  ]);
  if (cachedSummary && cachedTitle) {
    return { title: cachedTitle, summary: cachedSummary };
  }

  try {
    const source =
      article.source === 'hn'      ? 'Hacker News'  :
      article.source === 'reddit'  ? 'Reddit'        :
      article.source === 'lobsters'? 'Lobsters'      :
      article.rssSource ?? 'Tech news';

    const raw = await callOpenAI(
      [
        {
          role: 'system',
          content:
`You are a senior editor at a respected tech publication. For every article you receive, produce two things:

HEADLINE — A precise, declarative headline, max 12 words. Strip any "Ask HN:", "Show HN:", "[pdf]", "[video]" prefixes. State the specific who and what. No clickbait, no vague phrasing. Example: "OpenAI Releases GPT-5 With Significantly Improved Reasoning"

SUMMARY — 75–90 words. Write like The Economist or MIT Technology Review: authoritative, clear, no hype. Third person. One tight paragraph. Lead with the most important fact. Cover what happened, who is involved, the key detail, and why it matters to a technical reader. Do NOT open with "In this article", "This article", the headline, or a restatement of the title. No bullet points. No emoji.

Reply ONLY with this JSON (no markdown, no extra text):
{"headline":"...","summary":"..."}`,
        },
        {
          role: 'user',
          content:
`Source: ${source}
Title: "${article.title}"
Snippet: ${article.summary || '(no description available)'}`,
        },
      ],
      SUMMARY_MODEL,
      250
    );

    // Robust JSON extraction — handles GPT wrapping in ```json etc.
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    let parsed: { headline?: string; summary?: string };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }

    const newTitle   = parsed.headline?.trim() || null;
    const newSummary = parsed.summary?.trim()  || null;

    if (newTitle)   await setCacheTitle(article.id, newTitle);
    if (newSummary) await setCache(article.id, newSummary);

    return {
      title:   newTitle   ?? article.title,
      summary: newSummary ?? article.summary,
    };
  } catch {
    return null;
  }
}

export async function enhanceFeedContent(
  articles: Article[],
  onUpdate: (id: string, content: Partial<EnhancedContent>) => void
): Promise<void> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('YOUR_KEY')) return;

  // Enhance all articles (cache prevents redundant calls on repeat loads)
  const toEnhance = articles.slice(0, MAX_ENHANCE_PER_LOAD);

  const BATCH = 4;
  for (let i = 0; i < toEnhance.length; i += BATCH) {
    await Promise.all(
      toEnhance.slice(i, i + BATCH).map(async (a) => {
        const result = await enhanceOne(a);
        if (result) onUpdate(a.id, result);
      })
    );
  }
}

// ─── Explain chat (in-app, developer key) ────────────────────────────────────

export function buildSystemPrompt(article: Article): string {
  return `You are a sharp, knowledgeable tech journalist inside a news app called Pulse. The user just read a headline and wants to understand it better.

Article: "${article.title}"
${article.summary ? `Summary: ${article.summary}` : ''}

When responding:
- Be direct and insightful, like a senior journalist explaining to a smart colleague
- Use concrete analogies when helpful, skip them when they'd be condescending
- Keep responses to 3–5 sentences unless the user asks for more
- Never use emoji
- End your first response with "What would you like to dig into?"`;
}

export function buildFirstUserMessage(): string {
  return 'Can you explain this article to me in simple terms?';
}
