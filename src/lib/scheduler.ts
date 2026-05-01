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

export function formatDuration(minutes: number, lang?: string): string {
  const ru = lang === 'ru';
  if (minutes < 60) return ru ? `${minutes}м` : `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (ru) return m === 0 ? `${h}ч` : `${h}ч ${m}м`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface ScheduleResult {
  blocks: TimelineBlock[];
  overflow: Task[];
  totalMinutes: number;
  availableMinutes: number;
}

/**
 * Builds a daily schedule.
 *
 * Fixed-time tasks act as "anchors" — floating tasks are placed in the
 * gaps BEFORE each anchor (not after), so e.g. workout always appears
 * before edit@17:00 if there's enough time.
 *
 * ignoreNow=true → schedule from wake time (full-day preview/testing).
 * ignoreNow=false (default) → schedule from max(wake, now).
 */
export function buildSchedule(tasks: Task[], config: UserConfig, ignoreNow = false): ScheduleResult {
  const wake = timeToMinutes(config.wake);
  let sleep = timeToMinutes(config.sleep);
  // If sleep ≤ wake (e.g. 00:00 sleep, 07:00 wake) → treat as next-day
  if (sleep <= wake) sleep += 24 * 60;
  const availableMinutes = sleep - wake - (config.morning_buffer ?? 0);

  const pendingTasks = tasks.filter(t => !t.is_done && t.day === 'today');
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  // ── Separate fixed vs floating tasks ──────────────────────────────
  const fixedTasks = [...pendingTasks]
    .filter(t => t.fixed_time)
    .sort((a, b) => timeToMinutes(a.fixed_time!) - timeToMinutes(b.fixed_time!));

  const floatingTasks = [...pendingTasks]
    .filter(t => !t.fixed_time)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
    });

  const blocks: TimelineBlock[] = [];
  const overflow: Task[] = [];
  const nowMins = getNowMinutes();

  let cursor = ignoreNow
    ? wake + (config.morning_buffer ?? 0)
    : Math.max(wake + (config.morning_buffer ?? 0), nowMins);

  let floatIdx = 0;

  /** Place as many floating tasks as fit in [cursor … deadline). */
  const fillGap = (deadline: number) => {
    while (floatIdx < floatingTasks.length) {
      const task = floatingTasks[floatIdx];
      const travel = task.travel_minutes;
      const slot   = travel + task.duration_minutes + travel;
      const brk    = task.break_after ?? config.buffer;

      // Must fit entirely before deadline
      if (cursor + slot > deadline) break;

      blocks.push({ task, start_minutes: cursor, end_minutes: cursor + slot, is_overflow: false });
      cursor += slot;
      floatIdx++;

      // Add break only if it still fits before deadline
      if (brk > 0 && cursor + brk <= deadline) {
        blocks.push({ type: 'break', start_minutes: cursor, end_minutes: cursor + brk, label: 'Break' });
        cursor += brk;
      }
    }
  };

  // ── Place fixed tasks as anchors, fill gaps before each ──────────
  for (const task of fixedTasks) {
    const fixedStart = timeToMinutes(task.fixed_time!);
    const travel = task.travel_minutes;
    const slot   = travel + task.duration_minutes + travel;
    const brk    = task.break_after ?? config.buffer;

    if (fixedStart <= cursor) {
      // Fixed time already passed → place at current cursor
      if (cursor + slot > sleep) { overflow.push(task); continue; }
      blocks.push({ task, start_minutes: cursor, end_minutes: cursor + slot, is_overflow: false });
      cursor += slot;
      if (brk > 0 && cursor + brk <= sleep) {
        blocks.push({ type: 'break', start_minutes: cursor, end_minutes: cursor + brk, label: 'Break' });
        cursor += brk;
      }
      continue;
    }

    // Fill the gap before this anchor with floating tasks
    fillGap(fixedStart);

    // Any remaining gap → free time
    if (cursor < fixedStart) {
      blocks.push({ type: 'break', start_minutes: cursor, end_minutes: fixedStart, label: 'Free time' });
      cursor = fixedStart;
    }

    // Place the fixed task
    if (cursor + slot > sleep) { overflow.push(task); continue; }
    blocks.push({ task, start_minutes: cursor, end_minutes: cursor + slot, is_overflow: false });
    cursor += slot;
    if (brk > 0 && cursor + brk <= sleep) {
      blocks.push({ type: 'break', start_minutes: cursor, end_minutes: cursor + brk, label: 'Break' });
      cursor += brk;
    }
  }

  // ── Place remaining floating tasks after all anchors ──────────────
  fillGap(sleep);

  // Any unplaced floaters → overflow
  while (floatIdx < floatingTasks.length) {
    overflow.push(floatingTasks[floatIdx++]);
  }

  // ── Compute totals ─────────────────────────────────────────────────
  const placed = new Set(
    blocks
      .filter((b): b is { task: Task; start_minutes: number; end_minutes: number; is_overflow: boolean } => !('type' in b))
      .map(b => b.task.id)
  );
  const totalMinutes = pendingTasks
    .filter(t => placed.has(t.id))
    .reduce((s, t) => s + t.travel_minutes + t.duration_minutes + t.travel_minutes, 0);

  return { blocks, overflow, totalMinutes, availableMinutes };
}

export function isBreakBlock(block: TimelineBlock): block is BreakBlock {
  return 'type' in block && block.type === 'break';
}
