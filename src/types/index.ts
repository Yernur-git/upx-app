export type Priority = 'low' | 'medium' | 'high';
export type TaskDay = 'today' | 'tomorrow';
export type Theme = 'light' | 'dark';

export interface Task {
  id: string;
  title: string;
  duration_minutes: number;
  break_after: number;
  travel_minutes: number; // travel time before task (e.g. gym commute)
  priority: Priority;
  category: string;
  is_starred: boolean;
  is_done: boolean;
  day: TaskDay;
  fixed_time?: string; // HH:MM if user pinned a time
  notes?: string;
  created_at: string;
  user_id?: string;
}

export interface ScheduledBlock {
  task: Task;
  start_minutes: number; // minutes from midnight
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

export interface UserConfig {
  wake: string;      // "07:00"
  sleep: string;     // "23:00"
  buffer: number;    // default break minutes between tasks
  theme: Theme;
  gym_travel_minutes: number;
  known_contexts: Record<string, number>; // "gym" -> 20min travel etc
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

export interface AppState {
  tasks: Task[];
  config: UserConfig;
  chatMessages: ChatMessage[];
  isLoading: boolean;
  userId: string | null;
}
