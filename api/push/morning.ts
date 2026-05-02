/**
 * Vercel Cron — runs daily at 02:00 UTC (configured in vercel.json).
 * 02:00 UTC = 07:00 UTC+5 (Almaty / Tashkent).
 * Sends a morning briefing push to ALL subscribed users.
 *
 * NOTE: per-timezone delivery (each user gets it at their local 7 AM) requires
 * an hourly cron — available on Vercel Pro. On Hobby, this single daily run
 * covers UTC+5 precisely; other timezones receive it within a few hours of morning.
 *
 * Env vars required (Node runtime — no VITE_ prefix needed server-side):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_CONTACT   (mailto:you@example.com)
 *   CRON_SECRET     (any random string — add it in Vercel env vars)
 */
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Node.js runtime (default when edge config is absent)
export default async function handler(req: Request) {
  // Vercel passes CRON_SECRET automatically for cron routes; verify it
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const vapidPublic  = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidContact = process.env.VAPID_CONTACT || 'mailto:hello@upx.app';

  if (!vapidPublic || !vapidPrivate) {
    return new Response('VAPID keys not configured', { status: 500 });
  }

  webpush.setVapidDetails(vapidContact, vapidPublic, vapidPrivate);

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new Response('Supabase not configured', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch all push subscriptions (include tz_offset for timezone-aware dispatch)
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (subErr) {
    console.error('[push/morning] fetch subs:', subErr.message);
    return new Response('DB error', { status: 500 });
  }
  if (!subs?.length) return new Response(JSON.stringify({ sent: 0, reason: 'no subscribers' }));

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;
  const expired: string[] = [];

  for (const row of subs) {
    // Count today's tasks for this user
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, is_done')
      .eq('user_id', row.user_id)
      .eq('day', 'today');

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
      tag:  'upx-morning',
      url:  '/',
    });

    try {
      await webpush.sendNotification(
        row.subscription as webpush.PushSubscription,
        payload
      );
      sent++;
    } catch (err: unknown) {
      const pushErr = err as { statusCode?: number };
      if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
        // Subscription expired/gone — mark for cleanup
        expired.push(row.endpoint as string);
      } else {
        console.error('[push/morning] send error for', row.user_id, err);
      }
    }
  }

  // Clean up expired subscriptions
  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return new Response(
    JSON.stringify({ sent, expired: expired.length, date: today }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
