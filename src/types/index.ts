export type Priority = 'low' | 'medium' | 'high';
export type TaskDay = 'today' | 'tomorrow';
export type Theme = 'light' | 'dark';
export type Lang = 'en' | 'ru';
export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'custom';
export type AppPanel = 'plan' | 'stats' | 'profile';

export interface Task {
  id: string;
  title: string;
  duration_minutes: number;
  break_after: number;
  travel_minutes: number;
  priority: Priority;
  category: string;
  is_starred: boolean;
  is_done: boolean;
  day: TaskDay;
  fixed_time?: string;
  notes?: string;
  recurrence: Recurrence;
  recurrence_days?: number[]; // 0=Sun,1=Mon,...,6=Sat for 'custom'
  sort_order: number;
  created_at: string;
  user_id?: string;
}

export interface CategoryGoal {
  category: string;
  weekly_goal_minutes: number;
  color: string;
}

export interface ScheduledBlock {
  task: Task;
  start_minutes: number;
  end_minutes: number;
  is_overflow: boolean;
}

export interface BreakBlock {
  type: 'break';
  start_minutes: number;
  end_minutes: number;
  label: string;
}

export type TimelineBlock = ScheduledBlock | BreakBlock;

export interface QuickTask {
  id: string;
  emoji: string;
  title: string;
  duration_minutes: number;
  category: string;
  priority: Priority;
  fixed_time?: string; // optional HH:MM — locks the task to a specific time
}

export interface UserConfig {
  wake: string;
  sleep: string;
  buffer: number;
  morning_buffer: number;
  theme: Theme;
  language?: Lang;
  road_time_minutes: number;
  known_contexts: Record<string, number>;
  category_goals: CategoryGoal[];
  quick_tasks?: QuickTask[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  actions?: ParsedAction[];
}

export interface ParsedAction {
  type: 'create_task' | 'update_task' | 'delete_task' | 'move_task' | 'reschedule' | 'ask';
  payload: unknown;
}

/** Snapshot of a single task within a DayStats entry. */
export interface DayStatTask {
  id: string;
  title: string;
  category: string;
  duration_minutes: number;
  is_done: boolean;
}

export interface DayStats {
  /** ISO date YYYY-MM-DD (locale-independent). */
  date: string;
  total_minutes: number;
  done_minutes: number;
  done_count: number;
  total_count: number;
  /** Per-task snapshot — added in v4. Older entries may not have this. */
  tasks?: DayStatTask[];
}
