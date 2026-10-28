import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { moderateText } from '../_shared/moderation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Only this model is served regardless of what the client asks for.
const ALLOWED_MODEL = 'gpt-4o-mini';
const MAX_TOKENS_CAP = 1024;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, model, maxTokens } = await req.json();

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'NOT_CONFIGURED' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refuse inappropriate questions before they reach the model.
    const lastUser = Array.isArray(messages)
      ? [...messages].reverse().find((m: any) => m?.role === 'user')?.content
      : null;
    if (typeof lastUser === 'string' && lastUser.trim()) {
      const verdict = await moderateText(lastUser, openaiKey);
      if (verdict.flagged) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: "I can't help with that here. Ask me about the article or problem instead." } }],
            moderation_blocked: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: ALLOWED_MODEL, // client's `model` request is intentionally ignored
        max_tokens: Math.min(Number(maxTokens) || 512, MAX_TOKENS_CAP),
        messages,
      }),
    });

    const data = await res.json();

    // Always return 200 — include openai_status so client can handle errors
    return new Response(
      JSON.stringify(res.ok ? data : { error: data, openai_status: res.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
