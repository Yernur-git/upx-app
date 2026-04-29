/**
 * Vercel Cron — runs every 5 minutes.
 * For each push subscriber, finds tasks that start in the next 5–10 minutes
 * (in the user's local timezone) and sends a push reminder.
 *
 * Env vars: same as api/push/morning.ts
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT
 *   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 *   CRON_SECRET
 */
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Minutes before task start to send the notification
const REMIND_BEFORE = 10;
// Cron fires every 5 min — check a 5-min window to avoid duplicate sends
const WINDOW = 5;

export default async function handler(req: Request) {
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

  // Current UTC time in minutes since midnight
  const now = new Date();
  const nowUtcMins = now.getUTCHours() * 60 + now.getUTCMinutes();

  // Fetch all subscriptions with their timezone offsets
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, subscription, tz_offset');

  if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }));

  let sent = 0;
  const expired: string[] = [];

  for (const row of subs) {
    const tzOffset  = (row.tz_offset as number) ?? 0; // minutes east of UTC
    // User's local time in minutes since midnight
    const localMins = ((nowUtcMins + tzOffset) % (24 * 60) + 24 * 60) % (24 * 60);

    // Target window: tasks starting in [REMIND_BEFORE, REMIND_BEFORE + WINDOW) minutes
    const windowStart = localMins + REMIND_BEFORE;
    const windowEnd   = windowStart + WINDOW;

    // Fetch today's pending tasks with a fixed_time for this user
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, fixed_time, duration_minutes')
      .eq('user_id', row.user_id)
      .eq('day', 'today')
      .eq('is_done', false)
      .not('fixed_time', 'is', null);

    if (!tasks?.length) continue;

    for (const task of tasks) {
      const [h, m] = (task.fixed_time as string).split(':').map(Number);
      const taskMins = h * 60 + m;

      // Check if task falls in notification window
      const inWindow =
        taskMins >= windowStart && taskMins < windowEnd ||
        // Handle midnight wrap
        (windowEnd >= 24 * 60 && taskMins < windowEnd % (24 * 60));

      if (!inWindow) continue;

      const minsLeft = taskMins - localMins;
      const payload = JSON.stringify({
        title: `⏰ Starting in ${minsLeft} min`,
        body: task.title,
        tag: `upx-task-${task.id}`,
        url: '/',
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
          expired.push(row.endpoint as string);
        }
      }
    }
  }

  // Remove expired subscriptions
  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return new Response(JSON.stringify({ sent, expired: expired.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
