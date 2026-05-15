/**
 * Vercel Cron — runs every 5 minutes (via GitHub Actions).
 * For each push subscriber, finds tasks that start in the next 5–10 minutes
 * (in the user's local timezone) and sends a push reminder.
 *
 * Uses Edge Runtime with Web Crypto API (no Node.js crypto needed).
 */
import { createClient } from '@supabase/supabase-js';
import { sendWebPush, type PushSubscription } from './_webpush-edge';

export const config = { runtime: 'edge' };

const REMIND_BEFORE = 10;
const WINDOW = 5;

export default async function handler(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[push/tasks] CRON_SECRET not configured');
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

  const now = new Date();
  const nowUtcMins = now.getUTCHours() * 60 + now.getUTCMinutes();

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, subscription, tz_offset');

  if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }));

  let sent = 0;
  const expired: string[] = [];

  for (const row of subs) {
    const tzOffset  = (row.tz_offset as number) ?? 0;
    const localMins = ((nowUtcMins + tzOffset) % (24 * 60) + 24 * 60) % (24 * 60);

    const userNow = new Date(now.getTime() + tzOffset * 60_000);
    const userToday = userNow.toISOString().slice(0, 10);

    const windowStart = localMins + REMIND_BEFORE;
    const windowEnd   = windowStart + WINDOW;

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, fixed_time, duration_minutes')
      .eq('user_id', row.user_id)
      .eq('is_done', false)
      .not('fixed_time', 'is', null)
      .or(`day.eq.today,planned_date.eq.${userToday}`);

    if (!tasks?.length) continue;

    for (const task of tasks) {
      const [h, m] = (task.fixed_time as string).split(':').map(Number);
      const taskMins = h * 60 + m;

      const inWindow =
        taskMins >= windowStart && taskMins < windowEnd ||
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
        }
      } catch (err) {
        console.error('[push/tasks] error for', row.user_id, err);
      }
    }
  }

  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return new Response(JSON.stringify({ sent, expired: expired.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
