import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ---------- AUTH GATE ----------
  // Without this, anyone could unsubscribe any user from their push notifications
  // by guessing the endpoint+userId pair.
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[push/unsubscribe] SUPABASE_SERVICE_ROLE_KEY not configured');
    return new Response('Server not configured', { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData?.user) return new Response('Invalid session', { status: 401 });
  const authedUserId = userData.user.id;

  let body: { endpoint?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { endpoint, userId: claimedUserId } = body;
  if (!endpoint) return new Response('Missing endpoint', { status: 400 });
  if (claimedUserId && claimedUserId !== authedUserId) {
    return new Response('userId mismatch', { status: 403 });
  }

  // Always scope by authed user — never trust the client to say whose row to drop.
  await admin.from('push_subscriptions').delete()
    .eq('endpoint', endpoint)
    .eq('user_id', authedUserId);

  return new Response('ok');
}
