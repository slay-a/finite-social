const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const respond = (body: object) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return respond({ error: 'Missing authorization header' });

    const url            = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify caller's JWT — get user ID
    const meRes = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!meRes.ok) return respond({ error: `Auth check failed: ${meRes.status}` });
    const { id: userId } = await meRes.json();
    if (!userId) return respond({ error: 'Could not identify user' });

    // 2. Delete profile row via PostgREST
    const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    });
    if (!profileRes.ok) {
      const text = await profileRes.text();
      return respond({ error: `Profile delete failed: ${text}` });
    }

    // 3. Delete auth user via Admin API
    const authRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    });
    if (!authRes.ok) {
      const text = await authRes.text();
      return respond({ error: `Auth delete failed: ${text}` });
    }

    return respond({ success: true });

  } catch (e) {
    return respond({ error: `Exception: ${String(e)}` });
  }
});
