// Debug: show what the tasks endpoint sees for each subscriber
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new Response('Missing config', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();
  const nowUtcMins = now.getUTCHours() * 60 + now.getUTCMinutes();

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, tz_offset');

  if (!subs?.length) {
    return new Response(JSON.stringify({ error: 'no subs' }));
  }

  const debug = [];

  for (const row of subs) {
    const tzOffset = (row.tz_offset as number) ?? 0;
    const localMins = ((nowUtcMins + tzOffset) % (24 * 60) + 24 * 60) % (24 * 60);
    const localH = Math.floor(localMins / 60);
    const localM = localMins % 60;

    const userNow = new Date(now.getTime() + tzOffset * 60_000);
    const userToday = userNow.toISOString().slice(0, 10);

    const windowStart = localMins + 10;
    const windowEnd = windowStart + 5;

    // Fetch ALL today's tasks with fixed_time
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, fixed_time, day, planned_date, is_done')
      .eq('user_id', row.user_id)
      .eq('is_done', false)
      .not('fixed_time', 'is', null)
      .or(`day.eq.today,planned_date.eq.${userToday}`);

    const taskDebug = (tasks ?? []).map((t) => {
      const [h, m] = (t.fixed_time as string).split(':').map(Number);
      const taskMins = h * 60 + m;
      const inWindow = taskMins >= windowStart && taskMins < windowEnd;
      return {
        title: t.title,
        fixed_time: t.fixed_time,
        taskMins,
        inWindow,
        day: t.day,
        planned_date: t.planned_date,
      };
    });

    debug.push({
      user_id: row.user_id,
      tz_offset: tzOffset,
      utc_now: now.toISOString(),
      utc_mins: nowUtcMins,
      local_time: `${String(localH).padStart(2, '0')}:${String(localM).padStart(2, '0')}`,
      local_mins: localMins,
      user_today: userToday,
      window: `${windowStart}-${windowEnd} (${Math.floor(windowStart / 60)}:${String(windowStart % 60).padStart(2, '0')}-${Math.floor(windowEnd / 60)}:${String(windowEnd % 60).padStart(2, '0')})`,
      tasks_found: tasks?.length ?? 0,
      tasks: taskDebug,
    });
  }

  return new Response(JSON.stringify(debug, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
