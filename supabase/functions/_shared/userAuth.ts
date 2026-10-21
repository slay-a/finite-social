// In-function JWT verification (functions deploy with --no-verify-jwt because
// the gateway 401s ES256 JWTs — see README). Same pattern as delete-account.
export async function verifyUser(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing authorization header' }, 401);
  }
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const meRes = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!meRes.ok) return json({ error: `Auth check failed: ${meRes.status}` }, 401);
  const { id } = await meRes.json();
  if (!id) return json({ error: 'Could not identify user' }, 401);
  return { userId: id };
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
