// OpenAI moderation (free endpoint). Fail-open on errors so an outage never
// blocks legitimate content; flagged content is refused with a clear reason.
export interface ModerationResult {
  flagged: boolean;
  reason: string | null;
}

// LLM topic gate for uploads. Adult prose and political advocacy are refused
// unless the document treats its subject educationally (a civics textbook
// passes, an op-ed collection does not). Fail-open like moderateText.
export interface DocClassification {
  docType: 'textbook' | 'academic_paper' | 'technical' | 'news' | 'fiction' | 'political_opinion' | 'adult' | 'other';
  educational: boolean;
}

const DOC_TYPES = ['textbook', 'academic_paper', 'technical', 'news', 'fiction', 'political_opinion', 'adult', 'other'];

export async function classifyDocument(sample: string, apiKey: string): Promise<DocClassification | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Classify the document excerpt. Reply with JSON {"doc_type": one of ' +
              DOC_TYPES.map((t) => `"${t}"`).join(', ') +
              ', "educational": boolean}. doc_type is the dominant nature of the document. ' +
              '"adult" means sexually explicit prose. "political_opinion" means advocacy, ' +
              'campaign material, or opinion writing on contested political issues. ' +
              '"educational" is true only when the document teaches its subject in a ' +
              'textbook, academic, or technical manner (a history or civics textbook is ' +
              'educational; an op-ed or manifesto is not).',
          },
          { role: 'user', content: sample.slice(0, 12_000) },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
    if (!DOC_TYPES.includes(parsed?.doc_type)) return null;
    return { docType: parsed.doc_type, educational: parsed.educational === true };
  } catch {
    return null;
  }
}

export async function moderateText(text: string, apiKey: string): Promise<ModerationResult> {
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: text.slice(0, 30_000),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { flagged: false, reason: null };
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result?.flagged) return { flagged: false, reason: null };
    const categories = Object.entries(result.categories ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k.replace(/[/_-]/g, ' '));
    return { flagged: true, reason: categories.slice(0, 3).join(', ') || 'policy violation' };
  } catch {
    return { flagged: false, reason: null };
  }
}
