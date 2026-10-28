// OpenAI moderation (free endpoint). Fail-open on errors so an outage never
// blocks legitimate content; flagged content is refused with a clear reason.
export interface ModerationResult {
  flagged: boolean;
  reason: string | null;
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
