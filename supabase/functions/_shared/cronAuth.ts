// Cron-triggered functions are deployed with --no-verify-jwt (the gateway 401s
// ES256 JWTs — see README) and authenticate with a shared secret header set by
// the pg_cron job (from Vault) and stored as a function secret (CRON_SECRET).
export function checkCronSecret(req: Request): Response | null {
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const got = req.headers.get('x-cron-secret');
  if (got !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}
