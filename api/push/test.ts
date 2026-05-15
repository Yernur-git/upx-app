// Diagnostic endpoint — tests Web Push sending via Edge runtime
// Remove after debugging
import { createClient } from '@supabase/supabase-js';
import { sendWebPush, type PushSubscription } from './_webpush-edge';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  // Allow unauthenticated access for basic health check
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({
      ok: true,
      runtime: 'edge',
      env: {
        CRON_SECRET: cronSecret ? 'set' : 'MISSING',
        VAPID_PUBLIC: process.env.VAPID_PUBLIC_KEY ? 'set' : 'MISSING',
        VAPID_PRIVATE: process.env.VAPID_PRIVATE_KEY ? 'set' : 'MISSING',
        SUPABASE_URL: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) ? 'set' : 'MISSING',
        SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
      },
      hint: 'Send with Authorization: Bearer <CRON_SECRET> to test actual push send',
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Authenticated — test actual push sending
  const vapidPublic  = process.env.VAPID_PUBLIC_KEY!;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY!;
  const vapidContact = process.env.VAPID_CONTACT || 'mailto:hurah492@gmail.com';

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, subscription')
    .limit(1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!subs?.length) {
    return new Response(JSON.stringify({ result: 'no subscriptions found' }));
  }

  const payload = JSON.stringify({
    title: '🧪 Test Push',
    body: 'If you see this, Web Push works!',
    tag: 'upx-test',
    url: '/',
  });

  try {
    const result = await sendWebPush(
      subs[0].subscription as PushSubscription,
      payload,
      vapidPublic,
      vapidPrivate,
      vapidContact
    );
    return new Response(JSON.stringify({
      pushResult: result,
      sentTo: subs[0].user_id,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    return new Response(JSON.stringify({
      error: (err as Error).message,
      stack: (err as Error).stack?.slice(0, 500),
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
