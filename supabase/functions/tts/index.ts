// Neural text-to-speech for Listen mode. Generates audiobook-quality mp3
// narration with OpenAI gpt-4o-mini-tts and caches it in the private `tts`
// bucket keyed by content hash, so each card is only synthesized once ever.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyUser, json, corsHeaders } from '../_shared/userAuth.ts';

const TTS_MODEL = 'gpt-4o-mini-tts';
const VOICES: Record<string, string> = { female: 'nova', male: 'onyx' };
const MAX_INPUT_CHARS = 4000;
const SIGNED_URL_TTL = 3600;
const BUCKET = 'tts';

const INSTRUCTIONS =
  'Narrate like a warm, engaged audiobook narrator reading to a curious listener. ' +
  'Natural pacing with brief pauses between sentences and ideas. Vary your intonation ' +
  'with the meaning of the text. Clear and expressive, never flat or rushed.';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const auth = await verifyUser(req);
  if (auth instanceof Response) return auth;

  try {
    const { text, voice } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return json({ error: 'text required' }, 400);
    }
    const input = text.trim().slice(0, MAX_INPUT_CHARS);
    const voiceName = VOICES[voice as string] ?? VOICES.female;

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return json({ error: 'NOT_CONFIGURED' });

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const path = `${await sha256Hex(`${TTS_MODEL}:${voiceName}\n${input}`)}.mp3`;

    // Cache hit: the clip was synthesized before, just re-sign it.
    const cached = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (cached.data?.signedUrl) {
      return json({ url: cached.data.signedUrl, cached: true });
    }

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: voiceName,
        input,
        instructions: INSTRUCTIONS,
        response_format: 'mp3',
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: 'tts failed', openai_status: res.status, detail: detail.slice(0, 300) });
    }
    const bytes = new Uint8Array(await res.arrayBuffer());

    let up = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (up.error && /bucket/i.test(up.error.message ?? '')) {
      // Bucket missing (migration not pushed yet): create it and retry once.
      await sb.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 10485760,
        allowedMimeTypes: ['audio/mpeg'],
      }).catch(() => {});
      up = await sb.storage.from(BUCKET).upload(path, bytes, {
        contentType: 'audio/mpeg',
        upsert: true,
      });
    }
    if (up.error) return json({ error: `store failed: ${up.error.message}` });

    const signed = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (!signed.data?.signedUrl) return json({ error: 'sign failed' });
    return json({ url: signed.data.signedUrl });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
