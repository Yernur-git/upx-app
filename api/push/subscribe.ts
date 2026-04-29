import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: { subscription: unknown; userId: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { subscription, userId, tzOffset } = body as { subscription: unknown; userId: string; tzOffset?: number };
  if (!subscription || !userId) {
    return new Response('Missing subscription or userId', { status: 400 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new Response('Server not configured', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const sub = subscription as { endpoint: string };
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
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
