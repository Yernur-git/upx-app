import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ---------- AUTH GATE ----------
  // Without this, anyone could upsert a push_subscriptions row with an arbitrary
  // user_id and start receiving that victim's morning briefings + task titles.
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Fail closed — without the service key we cannot validate the bearer token.
    console.error('[push/subscribe] SUPABASE_SERVICE_ROLE_KEY not configured');
    return new Response('Server not configured', { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData?.user) return new Response('Invalid session', { status: 401 });
  const authedUserId = userData.user.id;

  let body: { subscription: unknown; userId?: string; tzOffset?: number };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { subscription, userId: claimedUserId, tzOffset } = body;
  if (!subscription) {
    return new Response('Missing subscription', { status: 400 });
  }
  // Ignore client-supplied userId — always use the authenticated user. If a
  // client claims a different uid we refuse rather than silently overriding.
  if (claimedUserId && claimedUserId !== authedUserId) {
    return new Response('userId mismatch', { status: 403 });
  }

  const sub = subscription as { endpoint?: string };
  if (!sub.endpoint || typeof sub.endpoint !== 'string') {
    return new Response('Missing subscription.endpoint', { status: 400 });
  }
  if (typeof tzOffset !== 'undefined' && (typeof tzOffset !== 'number' || !Number.isFinite(tzOffset))) {
    return new Response('Invalid tzOffset', { status: 400 });
  }

  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: authedUserId,
      endpoint: sub.endpoint,
      subscription,
      tz_offset: tzOffset ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('[push/subscribe]', error.message);
    return new Response('DB error', { status: 500 });
  }

  return new Response('ok');
}
