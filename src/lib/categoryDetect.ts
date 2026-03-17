import { Category } from '../types';

export function detectCategory(title: string, tags: string[]): Category {
  const lower = (title + ' ' + tags.join(' ')).toLowerCase();
  if (/\b(ai|gpt|llm|machine learning|deep learning|neural|openai|anthropic|gemini|claude|copilot|diffusion|transformer)\b/.test(lower)) return 'AI';
  if (/\b(security|hack|breach|vuln|malware|exploit|phishing|ransomware|privacy|cyber|zero.?day|cve)\b/.test(lower)) return 'Security';
  if (/\b(startup|yc|ycombinator|founder|vc|venture|funding|seed round|series [a-d]|unicorn|acquisition)\b/.test(lower)) return 'Startups';
  if (/\b(science|research|physics|biology|chemistry|genome|space|nasa|study|journal|climate|quantum|crispr)\b/.test(lower)) return 'Science';
  return 'Dev';
}
