// Diagnostic endpoint — remove after debugging
export const config = { runtime: 'nodejs' };

export default async function handler(_req: Request) {
  const checks: Record<string, string> = {};

  // 1. Check env vars
  checks.CRON_SECRET = process.env.CRON_SECRET ? 'set' : 'MISSING';
  checks.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ? 'set' : 'MISSING';
  checks.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ? 'set' : 'MISSING';
  checks.SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) ? 'set' : 'MISSING';
  checks.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING';

  // 2. Check web-push import
  try {
    const webpush = await import('web-push');
    checks.webpush = webpush ? 'ok' : 'null';
  } catch (err: unknown) {
    checks.webpush = `FAIL: ${(err as Error).message?.slice(0, 200)}`;
  }

  // 3. Check supabase import
  try {
    const { createClient } = await import('@supabase/supabase-js');
    checks.supabase = createClient ? 'ok' : 'null';
  } catch (err: unknown) {
    checks.supabase = `FAIL: ${(err as Error).message?.slice(0, 200)}`;
  }

  return new Response(JSON.stringify(checks, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
