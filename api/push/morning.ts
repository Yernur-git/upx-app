/**
 * Vercel Cron — runs daily at 02:00 UTC (configured in vercel.json).
 * 02:00 UTC = 07:00 UTC+5 (Almaty / Tashkent).
 * Sends a morning briefing push to ALL subscribed users.
 *
 * Uses Edge Runtime with Web Crypto API (no Node.js crypto needed).
 */
import { createClient } from '@supabase/supabase-js';
import { sendWebPush, type PushSubscription } from './_webpush-edge';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[push/morning] CRON_SECRET not configured');
    return new Response('Server not configured', { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const vapidPublic  = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidContact = process.env.VAPID_CONTACT || 'mailto:hurah492@gmail.com';
  if (!vapidPublic || !vapidPrivate) {
    return new Response('VAPID keys not configured', { status: 500 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new Response('Supabase not configured', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (subErr) {
    console.error('[push/morning] fetch subs:', subErr.message);
    return new Response('DB error', { status: 500 });
  }
  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no subscribers' }));
  }

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;
  const expired: string[] = [];

  for (const row of subs) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, is_done')
      .eq('user_id', row.user_id)
      .or(`day.eq.today,planned_date.eq.${today}`);

    const total = tasks?.length ?? 0;
    const done  = tasks?.filter((t: { is_done: boolean }) => t.is_done).length ?? 0;

    let body: string;
    if (total === 0) {
      body = 'No tasks yet — open UpX to plan your day 📋';
    } else if (done === total) {
      body = `All ${total} tasks done! Great work 🎉`;
    } else {
      body = `${total - done} of ${total} tasks remaining today`;
    }

    const payload = JSON.stringify({
      title: '☀️ Good morning, UpX!',
      body,
      tag: 'upx-morning',
      url: '/',
    });

    try {
      const result = await sendWebPush(
        row.subscription as PushSubscription,
        payload,
        vapidPublic,
        vapidPrivate,
        vapidContact
      );
      if (result.success) {
        sent++;
      } else if (result.status === 410 || result.status === 404) {
        expired.push(row.endpoint as string);
      } else {
        console.error('[push/morning] send failed:', result.status, result.statusText);
      }
    } catch (err) {
      console.error('[push/morning] send error for', row.user_id, err);
    }
  }

  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return new Response(
    JSON.stringify({ sent, expired: expired.length, date: today }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
