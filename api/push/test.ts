// Diagnostic endpoint — remove after debugging
export const config = { runtime: 'nodejs' };

export default async function handler(_req: Request) {
  const out: Record<string, string> = {};
  out.start = 'yes';
  out.node_version = process.version;

  // 1. env vars
  out.VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ? 'set' : 'MISSING';
  out.VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ? 'set' : 'MISSING';
  out.SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) ? 'set' : 'MISSING';
  out.SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING';
  out.CRON_SECRET = process.env.CRON_SECRET ? 'set' : 'MISSING';

  // 2. web-push import
  try {
    const mod = await import('web-push');
    out.wp_keys = Object.keys(mod).slice(0, 10).join(',');
    out.wp_default_type = typeof mod.default;
    out.wp_setVapid_direct = typeof (mod as Record<string, unknown>).setVapidDetails;
    out.wp_setVapid_default = typeof mod.default?.setVapidDetails;
  } catch (e: unknown) {
    out.wp_error = String((e as Error).message).slice(0, 300);
  }

  // 3. supabase import
  try {
    const { createClient } = await import('@supabase/supabase-js');
    out.supa = typeof createClient;
  } catch (e: unknown) {
    out.supa_error = String((e as Error).message).slice(0, 300);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
