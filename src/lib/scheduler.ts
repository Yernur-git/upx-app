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

export function buildSchedule(tasks: Task[], config: UserConfig): ScheduleResult {
  const wake = timeToMinutes(config.wake);
  const sleep = timeToMinutes(config.sleep);
  const availableMinutes = sleep - wake;

  const doneTasks = tasks.filter(t => t.is_done && t.day === 'today');
  const pendingTasks = tasks.filter(t => !t.is_done && t.day === 'today');

  // Fixed-time tasks first, then by priority, then by creation order
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...pendingTasks].sort((a, b) => {
    if (a.fixed_time && !b.fixed_time) return -1;
    if (!a.fixed_time && b.fixed_time) return 1;
    if (a.fixed_time && b.fixed_time) {
      return timeToMinutes(a.fixed_time) - timeToMinutes(b.fixed_time);
    }
    if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const blocks: TimelineBlock[] = [];
  const overflow: Task[] = [];
  let cursor = wake;

  // Place done tasks at the beginning (visual only)
  for (const task of doneTasks) {
    const totalDuration = task.travel_minutes + task.duration_minutes + task.travel_minutes;
    blocks.push({
      task,
      start_minutes: wake,
      end_minutes: wake + totalDuration,
      is_overflow: false,
    });
  }

  for (const task of sorted) {
    const travelBefore = task.travel_minutes;
    const travelAfter = task.travel_minutes > 0 ? task.travel_minutes : 0;
    const totalSlot = travelBefore + task.duration_minutes + travelAfter;
    const breakAfter = task.break_after ?? config.buffer;

    // Handle fixed time
    if (task.fixed_time) {
      const fixedStart = timeToMinutes(task.fixed_time);
      if (fixedStart >= cursor && fixedStart + totalSlot <= sleep) {
        // Add idle gap if needed
        if (fixedStart > cursor) {
          blocks.push({
            type: 'break',
            start_minutes: cursor,
            end_minutes: fixedStart,
            label: 'Free time',
          });
        }
        cursor = fixedStart;
      }
    }

    if (cursor + totalSlot > sleep) {
      overflow.push(task);
      continue;
    }

    blocks.push({
      task,
      start_minutes: cursor,
      end_minutes: cursor + totalSlot,
      is_overflow: false,
    });

    cursor += totalSlot;

    if (breakAfter > 0 && cursor + breakAfter <= sleep) {
      blocks.push({
        type: 'break',
        start_minutes: cursor,
        end_minutes: cursor + breakAfter,
        label: '☕ Break',
      });
      cursor += breakAfter;
    }
  }

  const totalMinutes = sorted.reduce((s, t) => {
    if (!overflow.find(o => o.id === t.id)) {
      return s + t.travel_minutes + t.duration_minutes + t.travel_minutes;
    }
    return s;
  }, 0);

  return { blocks, overflow, totalMinutes, availableMinutes };
}

export function isBreakBlock(block: TimelineBlock): block is BreakBlock {
  return 'type' in block && block.type === 'break';
}
