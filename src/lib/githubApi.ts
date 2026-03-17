import { Article, Category } from '../types';

interface GithubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  owner: { login: string };
  topics: string[];
  created_at: string;
  pushed_at: string;
}

// 1-hour in-memory cache so we don't burn GitHub's 10 req/min unauthenticated limit
const cache = new Map<string, { data: Article[]; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function detectGithubCategory(repo: GithubRepo): Category {
  const text = `${repo.name} ${repo.description ?? ''} ${repo.topics.join(' ')} ${repo.language ?? ''}`.toLowerCase();
  if (/\bai\b|llm|gpt|neural|machine.?learning|deep.?learning|pytorch|tensorflow|diffusion|transformer/.test(text)) return 'AI';
  if (/security|cve|exploit|pentest|ctf|crypto(?!currency)|vuln/.test(text)) return 'Security';
  if (/startup|saas|commerce|business/.test(text)) return 'Startups';
  if (/science|biology|physics|chemistry|paper|research/.test(text)) return 'Science';
  return 'Dev';
}

function mapRepo(repo: GithubRepo, category: Category): Article {
  const stars =
    repo.stargazers_count >= 1000
      ? `${(repo.stargazers_count / 1000).toFixed(1)}k ⭐`
      : `${repo.stargazers_count} ⭐`;

  const langTag = repo.language?.toLowerCase();
  const summary = repo.description?.trim()
    ? `${stars}  ·  ${repo.description.trim()}`
    : `${stars}  ·  ${repo.forks_count} forks`;

  return {
    id: `github-${repo.id}`,
    source: 'github',
    title: repo.full_name,
    summary,
    url: repo.html_url,
    author: repo.owner.login,
    tags: [
      ...(langTag ? [langTag] : []),
      ...repo.topics.slice(0, 3),
    ].filter(Boolean),
    category,
    publishedAt: repo.pushed_at ?? repo.created_at,
    points: repo.stargazers_count,
    // No imageUrl — GitHub avatars look odd stretched across the hero area;
    // the placeholder with repo name looks better.
  };
}

export async function fetchGithubTrending(category: Category, page = 0): Promise<Article[]> {
  const cacheKey = `${category}-${page}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  // Widen the window on later pages to get more variety
  const since = daysAgoISO(7 + page * 7);
  const url = `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=25&page=${page + 1}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);

  const json = (await res.json()) as { items: GithubRepo[] };

  const articles = json.items
    .filter((r) => r.description) // skip repos with no description
    .map((r) => {
      const cat =
        category === 'All' || category === 'Repos'
          ? detectGithubCategory(r)
          : category;
      return mapRepo(r, cat);
    });

  cache.set(cacheKey, { data: articles, ts: Date.now() });
  return articles;
}
