import { describe, it, expect } from 'vitest';
import { timeToMinutes, minutesToTime, formatDuration, buildSchedule, isBreakBlock } from '../scheduler';
import type { Task, UserConfig } from '../../types';

// ── Utility functions ─────────────────────────────────────────────────

describe('timeToMinutes', () => {
  it('converts midnight', () => expect(timeToMinutes('00:00')).toBe(0));
  it('converts 7:00', () => expect(timeToMinutes('07:00')).toBe(420));
  it('converts 23:59', () => expect(timeToMinutes('23:59')).toBe(1439));
  it('converts 12:30', () => expect(timeToMinutes('12:30')).toBe(750));
});

describe('minutesToTime', () => {
  it('formats 0 → 00:00', () => expect(minutesToTime(0)).toBe('00:00'));
  it('formats 420 → 07:00', () => expect(minutesToTime(420)).toBe('07:00'));
  it('formats 750 → 12:30', () => expect(minutesToTime(750)).toBe('12:30'));
  it('wraps past midnight', () => expect(minutesToTime(24 * 60 + 30)).toBe('00:30'));
});

describe('formatDuration', () => {
  it('formats minutes (en)', () => expect(formatDuration(45)).toBe('45m'));
  it('formats hours (en)', () => expect(formatDuration(120)).toBe('2h'));
  it('formats mixed (en)', () => expect(formatDuration(90)).toBe('1h 30m'));
  it('formats minutes (ru)', () => expect(formatDuration(45, 'ru')).toBe('45м'));
  it('formats hours (ru)', () => expect(formatDuration(120, 'ru')).toBe('2ч'));
  it('formats mixed (ru)', () => expect(formatDuration(90, 'ru')).toBe('1ч 30м'));
});

// ── buildSchedule ─────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    title: 'Test task',
    duration_minutes: 30,
    break_after: 0,
    travel_minutes: 0,
    priority: 'medium',
    category: 'work',
    is_starred: false,
    is_done: false,
    day: 'today',
    recurrence: 'none',
    sort_order: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const defaultConfig: UserConfig = {
  wake: '07:00',
  sleep: '23:00',
  buffer: 10,
  morning_buffer: 0,
  language: 'en',
  theme: 'light',
  category_goals: [],
};

describe('buildSchedule', () => {
  it('returns empty for no tasks', () => {
    const result = buildSchedule([], defaultConfig, true);
    expect(result.blocks).toHaveLength(0);
    expect(result.overflow).toHaveLength(0);
    expect(result.totalMinutes).toBe(0);
  });

  it('skips done tasks', () => {
    const tasks = [makeTask({ is_done: true })];
    const result = buildSchedule(tasks, defaultConfig, true);
    expect(result.blocks).toHaveLength(0);
  });

  it('skips tomorrow tasks', () => {
    const tasks = [makeTask({ day: 'tomorrow' })];
    const result = buildSchedule(tasks, defaultConfig, true);
    expect(result.blocks).toHaveLength(0);
  });

  it('places a single floating task at wake time', () => {
    const tasks = [makeTask({ title: 'Work', duration_minutes: 60 })];
    const result = buildSchedule(tasks, defaultConfig, true);
    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0];
    expect('task' in block && block.task.title).toBe('Work');
    expect(block.start_minutes).toBe(420); // 07:00
    expect(block.end_minutes).toBe(480);   // 08:00
  });

  it('places fixed-time tasks at their specified time', () => {
    const tasks = [makeTask({ title: 'Meeting', fixed_time: '14:00', duration_minutes: 60 })];
    const result = buildSchedule(tasks, defaultConfig, true);
    // Should have: free-time break + task block
    const taskBlock = result.blocks.find(b => !isBreakBlock(b));
    expect(taskBlock).toBeDefined();
    expect(taskBlock!.start_minutes).toBe(840); // 14:00
  });

  it('fills gaps before fixed tasks with floating tasks', () => {
    const tasks = [
      makeTask({ title: 'Float', duration_minutes: 30 }),
      makeTask({ title: 'Fixed', fixed_time: '10:00', duration_minutes: 60 }),
    ];
    const result = buildSchedule(tasks, defaultConfig, true);
    const taskBlocks = result.blocks.filter(b => !isBreakBlock(b));
    expect(taskBlocks).toHaveLength(2);
    // Float should come before Fixed
    expect('task' in taskBlocks[0] && taskBlocks[0].task.title).toBe('Float');
    expect('task' in taskBlocks[1] && taskBlocks[1].task.title).toBe('Fixed');
  });

  it('respects morning buffer', () => {
    const config = { ...defaultConfig, morning_buffer: 30 };
    const tasks = [makeTask({ duration_minutes: 30 })];
    const result = buildSchedule(tasks, config, true);
    expect(result.blocks[0].start_minutes).toBe(450); // 07:00 + 30 buffer
  });

  it('puts overflow tasks when they dont fit', () => {
    // Sleep at 23:00 = 1380 min. Wake at 07:00 = 420 min. Available = 960 min
    // Create task that takes more than available
    const tasks = [makeTask({ duration_minutes: 1000 })];
    const result = buildSchedule(tasks, defaultConfig, true);
    expect(result.overflow).toHaveLength(1);
    expect(result.blocks.filter(b => !isBreakBlock(b))).toHaveLength(0);
  });

  it('adds breaks between tasks', () => {
    const config = { ...defaultConfig, buffer: 15 };
    const tasks = [
      makeTask({ title: 'A', duration_minutes: 30, sort_order: 0, break_after: 15 }),
      makeTask({ title: 'B', duration_minutes: 30, sort_order: 1 }),
    ];
    const result = buildSchedule(tasks, config, true);
    const breaks = result.blocks.filter(isBreakBlock);
    expect(breaks.length).toBeGreaterThanOrEqual(1);
    expect(breaks[0].end_minutes - breaks[0].start_minutes).toBe(15);
  });

  it('handles sleep before wake (next-day sleep)', () => {
    const config = { ...defaultConfig, sleep: '01:00' }; // 1AM next day
    const tasks = [makeTask({ duration_minutes: 30 })];
    const result = buildSchedule(tasks, config, true);
    expect(result.availableMinutes).toBe((24 * 60 + 60) - 420); // 1080 min
    expect(result.blocks).toHaveLength(1);
  });

  it('includes travel time in block duration', () => {
    const tasks = [makeTask({ duration_minutes: 30, travel_minutes: 15 })];
    const result = buildSchedule(tasks, defaultConfig, true);
    const block = result.blocks[0];
    // travel + task + travel = 15 + 30 + 15 = 60
    expect(block.end_minutes - block.start_minutes).toBe(60);
  });

  it('sorts floating tasks by priority', () => {
    const tasks = [
      makeTask({ title: 'Low', priority: 'low', sort_order: 0 }),
      makeTask({ title: 'High', priority: 'high', sort_order: 0 }),
    ];
    const result = buildSchedule(tasks, defaultConfig, true);
    const taskBlocks = result.blocks.filter(b => !isBreakBlock(b));
    expect('task' in taskBlocks[0] && taskBlocks[0].task.title).toBe('High');
    expect('task' in taskBlocks[1] && taskBlocks[1].task.title).toBe('Low');
  });
});
