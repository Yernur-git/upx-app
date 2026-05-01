import type { Task } from '../types';
import { timeToMinutes } from './scheduler';

// Request permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function canNotify(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

// Schedule a browser notification at a given time (minutes from midnight)
function scheduleAt(minutesFromMidnight: number, title: string, body: string) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const diff = minutesFromMidnight - nowMins;

  if (diff <= 0) return; // already passed

  const ms = diff * 60 * 1000;

  const id = window.setTimeout(() => {
    if (Notification.permission !== 'granted') return;
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `upx-${minutesFromMidnight}`,
      silent: false,
    });
  }, ms);

  return id;
}

// Track scheduled timers so we can cancel them
const activeTimers = new Set<number>();

export function clearAllNotifications() {
  activeTimers.forEach(id => window.clearTimeout(id));
  activeTimers.clear();
}

// Schedule notifications for all tasks in a day
export function scheduleTaskNotifications(
  scheduleBlocks: Array<{ task: Task; start_minutes: number }>,
  reminderMinutes = 10
) {
  if (!canNotify()) return;

  clearAllNotifications();

  for (const block of scheduleBlocks) {
    const { task, start_minutes } = block;
    if (task.is_done) continue;

    // Reminder X minutes before
    const remindAt = start_minutes - reminderMinutes;
    if (remindAt > 0) {
      const id = scheduleAt(
        remindAt,
        `Starting in ${reminderMinutes}min`,
        task.title
      );
      if (id) activeTimers.add(id);
    }

    // At start time
    const id2 = scheduleAt(
      start_minutes,
      `Time to start`,
      task.title
    );
    if (id2) activeTimers.add(id2);
  }
}

// Morning briefing notification
export function scheduleMorningBriefing(wakeTime: string, taskCount: number) {
  if (!canNotify()) return;
  const wakeMin = timeToMinutes(wakeTime);
  const id = scheduleAt(
    wakeMin + 1,
    'Good morning',
    taskCount > 0 ? `You have ${taskCount} tasks planned today` : 'No tasks yet — open UpX to plan your day'
  );
  if (id) activeTimers.add(id);
}
