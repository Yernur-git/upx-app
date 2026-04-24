import type { Task, BreakBlock, TimelineBlock, UserConfig } from '../types';

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface ScheduleResult {
  blocks: TimelineBlock[];
  overflow: Task[];
  totalMinutes: number;
  availableMinutes: number;
}

/**
 * ignoreNow=true → schedule from wake time (useful for full-day preview/testing).
 * ignoreNow=false (default) → schedule from max(wake, now).
 */
export function buildSchedule(tasks: Task[], config: UserConfig, ignoreNow = false): ScheduleResult {
  const wake = timeToMinutes(config.wake);
  let sleep = timeToMinutes(config.sleep);
  // If sleep is at or before wake (e.g. sleep=00:00, wake=07:00), treat sleep as next-day midnight
  if (sleep <= wake) sleep += 24 * 60;
  const availableMinutes = sleep - wake - (config.morning_buffer ?? 0);

  const pendingTasks = tasks.filter(t => !t.is_done && t.day === 'today');

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...pendingTasks].sort((a, b) => {
    if (a.fixed_time && !b.fixed_time) return -1;
    if (!a.fixed_time && b.fixed_time) return 1;
    if (a.fixed_time && b.fixed_time) return timeToMinutes(a.fixed_time) - timeToMinutes(b.fixed_time);
    if (a.sort_order !== b.sort_order) return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const blocks: TimelineBlock[] = [];
  const overflow: Task[] = [];
  const nowMins = getNowMinutes();
  let cursor = ignoreNow
    ? wake + (config.morning_buffer ?? 0)
    : Math.max(wake + (config.morning_buffer ?? 0), nowMins);

  for (const task of sorted) {
    const travelTime = task.travel_minutes;
    const totalSlot = travelTime + task.duration_minutes + travelTime;
    const breakAfter = task.break_after ?? config.buffer;

    if (task.fixed_time) {
      const fixedStart = timeToMinutes(task.fixed_time);
      if (fixedStart >= cursor) {
        // Fixed time is ahead — jump to it if task fits before sleep
        if (fixedStart + totalSlot > sleep) { overflow.push(task); continue; }
        if (fixedStart > cursor) {
          blocks.push({ type: 'break', start_minutes: cursor, end_minutes: fixedStart, label: 'Free time' });
        }
        cursor = fixedStart;
      }
      // fixedStart < cursor: time passed, fall through and place at cursor
    }

    if (cursor + totalSlot > sleep) { overflow.push(task); continue; }

    blocks.push({ task, start_minutes: cursor, end_minutes: cursor + totalSlot, is_overflow: false });
    cursor += totalSlot;

    if (breakAfter > 0 && cursor + breakAfter <= sleep) {
      blocks.push({ type: 'break', start_minutes: cursor, end_minutes: cursor + breakAfter, label: '☕ Break' });
      cursor += breakAfter;
    }
  }

  const totalMinutes = sorted
    .filter(t => !overflow.find(o => o.id === t.id))
    .reduce((s, t) => s + t.travel_minutes + t.duration_minutes + t.travel_minutes, 0);

  return { blocks, overflow, totalMinutes, availableMinutes };
}

export function isBreakBlock(block: TimelineBlock): block is BreakBlock {
  return 'type' in block && block.type === 'break';
}
