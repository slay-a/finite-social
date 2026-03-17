import AsyncStorage from '@react-native-async-storage/async-storage';
import { OPENAI_API_KEY } from './config';
import { callOpenAI } from './aiService';
import { NEETCODE_150, BLIND_75_SLUGS, NeetcodeTopic } from './neetcodeData';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface LeetcodeProblem {
  id: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  acRate?: number; // acceptance % (0-100)
}

export interface LeetcodeExplanation {
  what: string;      // What the problem is asking (2 sentences)
  insight: string;   // Key trick or observation
  approach: string;  // Algorithm/pattern + how to apply it
  complexity: string; // Time & space
}

// ─── Problem list ─────────────────────────────────────────────────────────────

const PROBLEMS_KEY = 'finitesocial:leetcode:problems';
const PROBLEMS_TTL = 24 * 60 * 60 * 1000; // refresh daily

let problemsMemCache: LeetcodeProblem[] | null = null;

async function loadAllProblems(): Promise<LeetcodeProblem[]> {
  if (problemsMemCache) return problemsMemCache;

  // Try disk cache first
  try {
    const raw = await AsyncStorage.getItem(PROBLEMS_KEY);
    if (raw) {
      const { data, ts } = JSON.parse(raw) as { data: LeetcodeProblem[]; ts: number };
      if (Date.now() - ts < PROBLEMS_TTL) {
        problemsMemCache = data;
        return data;
      }
    }
  } catch {}

  // Fetch from LeetCode's public API (no auth required)
  const res = await fetch('https://leetcode.com/api/problems/algorithms/', {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`LeetCode API ${res.status}`);

  const json = await res.json();
  const problems: LeetcodeProblem[] = (json.stat_status_pairs as any[])
    .filter((p) => !p.paid_only && !p.stat.question__hide)
    .map((p): LeetcodeProblem => ({
      id: p.stat.question_id,
      title: p.stat.question__title,
      slug: p.stat.question__title_slug,
      difficulty: p.difficulty.level === 1 ? 'Easy' : p.difficulty.level === 2 ? 'Medium' : 'Hard',
      acRate:
        p.stat.total_acs && p.stat.total_submitted
          ? Math.round((p.stat.total_acs / p.stat.total_submitted) * 100)
          : undefined,
    }))
    // Shuffle once so every session feels fresh
    .sort(() => Math.random() - 0.5);

  problemsMemCache = problems;
  await AsyncStorage.setItem(PROBLEMS_KEY, JSON.stringify({ data: problems, ts: Date.now() }));
  return problems;
}

export async function getProblems(
  difficulty: Difficulty | 'All' = 'All',
  page = 0,
  pageSize = 20,
): Promise<LeetcodeProblem[]> {
  const all = await loadAllProblems();
  const filtered = difficulty === 'All' ? all : all.filter((p) => p.difficulty === difficulty);
  return filtered.slice(page * pageSize, (page + 1) * pageSize);
}

// ─── Curated lists (Top 150 / Top 75) ────────────────────────────────────────

export type ProblemSet = 'All' | 'LeetCode 150' | 'LeetCode 75';

export async function getCuratedProblems(
  set: 'LeetCode 150' | 'LeetCode 75',
  topic: NeetcodeTopic | 'All',
  difficulty: Difficulty | 'All',
): Promise<LeetcodeProblem[]> {
  const all = await loadAllProblems();
  const slugMap = new Map(all.map((p) => [p.slug, p]));

  let entries = set === 'LeetCode 75'
    ? NEETCODE_150.filter((e) => BLIND_75_SLUGS.has(e.slug))
    : NEETCODE_150;

  if (topic !== 'All') entries = entries.filter((e) => e.topic === topic);

  const problems = entries
    .map((e) => slugMap.get(e.slug))
    .filter((p): p is LeetcodeProblem => p !== undefined);

  return difficulty === 'All'
    ? problems
    : problems.filter((p) => p.difficulty === difficulty);
}

// ─── AI explanation ───────────────────────────────────────────────────────────

const EXPLAIN_PREFIX = 'finitesocial:leetcode:explain:';

export async function getExplanation(problem: LeetcodeProblem): Promise<LeetcodeExplanation> {
  const key = `${EXPLAIN_PREFIX}${problem.id}`;

  // Disk cache — explanations don't expire
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return JSON.parse(cached) as LeetcodeExplanation;
  } catch {}

  if (!OPENAI_API_KEY) {
    return {
      what: 'Add your OpenAI API key to see AI explanations.',
      insight: 'Set OPENAI_API_KEY in .env.local for local dev, or via EAS secrets for production.',
      approach: '',
      complexity: '',
    };
  }

  const raw = await callOpenAI(
    [
      {
        role: 'system',
        content:
`You are a coding interview coach. When given a LeetCode problem, respond ONLY with valid JSON — no markdown, no extra text:
{"what":"What the problem asks in 1-2 clear sentences","insight":"The key observation or trick that makes this solvable","approach":"The optimal algorithm/pattern and how to apply it here — 2-3 sentences","complexity":"Time: O(?) | Space: O(?)"}`,
      },
      {
        role: 'user',
        content: `Explain the LeetCode problem "${problem.title}" (${problem.difficulty} difficulty).`,
      },
    ],
    undefined, // uses EXPLAIN_MODEL from config
    400,
  );

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  const explanation = JSON.parse(jsonMatch[0]) as LeetcodeExplanation;

  await AsyncStorage.setItem(key, JSON.stringify(explanation));
  return explanation;
}
