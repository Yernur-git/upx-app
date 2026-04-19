import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, UserConfig, ChatMessage, ParsedAction, AppPanel, DayStats } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_CONFIG: UserConfig = {
  wake: '07:00',
  sleep: '23:00',
  buffer: 5,
  morning_buffer: 15,
  theme: 'light',
  road_time_minutes: 20,
  known_contexts: { gym: 20, office: 30 },
  category_goals: [
    { category: 'workout', weekly_goal_minutes: 360, color: '#5FA35F' },
    { category: 'deep work', weekly_goal_minutes: 1200, color: '#5C6B9C' },
  ],
};

interface Store {
  tasks: Task[];
  config: UserConfig;
  chatMessages: ChatMessage[];
  dayHistory: DayStats[];
  isLoading: boolean;
  userId: string | null;
  userEmail: string | null;
  apiKey: string;
  customBaseURL: string;
  customModel: string;
  chatOpen: boolean;
  activePanel: AppPanel;

  setUserId: (id: string | null) => void;
  setUserEmail: (email: string | null) => void;
  setApiKey: (key: string) => void;
  setCustomBaseURL: (url: string) => void;
  setCustomModel: (model: string) => void;
  setChatOpen: (open: boolean) => void;
  setActivePanel: (panel: AppPanel) => void;

  addTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  reorderTasks: (ids: string[]) => void;
  moveTask: (id: string, day: 'today' | 'tomorrow') => Promise<void>;

  updateConfig: (updates: Partial<UserConfig>) => Promise<void>;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'created_at'>) => void;
  applyActions: (actions: ParsedAction[]) => Promise<void>;
  saveDayStats: () => void;

  loadFromSupabase: () => Promise<void>;
  signOut: () => Promise<void>;
}

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

// Roll over recurring tasks at start of new day
function rolloverRecurring(tasks: Task[]): Task[] {
  const todayTasks = tasks.filter(t => t.day === 'today');
  const needsRollover = todayTasks.length === 0;

  if (!needsRollover) return tasks;

  const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
  const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;

  return tasks.map(t => {
    if (t.day !== 'tomorrow' || t.recurrence === 'none') return t;
    if (t.recurrence === 'weekdays' && !isWeekday) return t;
    return { ...t, day: 'today' as const, is_done: false };
  });
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      tasks: [],
      config: DEFAULT_CONFIG,
      chatMessages: [],
      dayHistory: [],
      isLoading: false,
      userId: null,
      userEmail: null,
      apiKey: '',
      customBaseURL: '',
      customModel: '',
      chatOpen: false,
      activePanel: 'plan',

      setUserId: (id) => set({ userId: id }),
      setUserEmail: (email) => set({ userEmail: email }),
      setApiKey: (key) => set({ apiKey: key }),
      setCustomBaseURL: (url) => set({ customBaseURL: url }),
      setCustomModel: (model) => set({ customModel: model }),
      setChatOpen: (open) => set({ chatOpen: open }),
      setActivePanel: (panel) => set({ activePanel: panel }),

      addTask: async (taskData) => {
        const tasks = get().tasks.filter(t => t.day === taskData.day);
        const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sort_order ?? 0), 0);
        const task: Task = {
          ...taskData,
          id: generateId(),
          sort_order: maxOrder + 1,
          created_at: new Date().toISOString(),
        };
        set(s => ({ tasks: [...s.tasks, task] }));
        const { userId } = get();
        if (userId) {
          await supabase.from('tasks').insert({ ...task, user_id: userId });
        }
        return task;
      },

      updateTask: async (id, updates) => {
        set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t) }));
        const { userId } = get();
        if (userId) {
          await supabase.from('tasks').update(updates).eq('id', id).eq('user_id', userId);
        }
      },

      deleteTask: async (id) => {
        set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }));
        const { userId } = get();
        if (userId) {
          await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
        }
      },

      toggleDone: async (id) => {
        const task = get().tasks.find(t => t.id === id);
        if (!task) return;
        await get().updateTask(id, { is_done: !task.is_done });
      },

      reorderTasks: (orderedIds) => {
        set(s => {
          const taskMap = new Map(s.tasks.map(t => [t.id, t]));
          const reordered = orderedIds
            .map((id, i) => taskMap.has(id) ? { ...taskMap.get(id)!, sort_order: i } : null)
            .filter(Boolean) as Task[];
          const rest = s.tasks.filter(t => !orderedIds.includes(t.id));
          return { tasks: [...reordered, ...rest] };
        });
      },

      moveTask: async (id, day) => {
        await get().updateTask(id, { day });
      },

      updateConfig: async (updates) => {
        set(s => ({ config: { ...s.config, ...updates } }));
        const { userId, config } = get();
        if (userId) {
          await supabase.from('user_config').upsert({ ...config, ...updates, user_id: userId });
        }
      },

      addChatMessage: (msg) => {
        const message: ChatMessage = { ...msg, id: generateId(), created_at: new Date().toISOString() };
        set(s => ({ chatMessages: [...s.chatMessages.slice(-50), message] }));
      },

      applyActions: async (actions) => {
        for (const action of actions) {
          const { addTask, updateTask, deleteTask, moveTask, reorderTasks } = get();
          switch (action.type) {
            case 'create_task': {
              const p = action.payload as Omit<Task, 'id' | 'created_at'>;
              await addTask({ ...p, recurrence: p.recurrence ?? 'none', sort_order: p.sort_order ?? 0, is_done: false });
              break;
            }
            case 'update_task': {
              const { id, ...updates } = action.payload as { id: string } & Partial<Task>;
              await updateTask(id, updates);
              break;
            }
            case 'delete_task': await deleteTask((action.payload as { id: string }).id); break;
            case 'move_task': {
              const { id, day } = action.payload as { id: string; day: 'today' | 'tomorrow' };
              await moveTask(id, day);
              break;
            }
            case 'reschedule': reorderTasks((action.payload as { order: string[] }).order); break;
          }
        }
      },

      saveDayStats: () => {
        const { tasks, dayHistory } = get();
        const todayStr = new Date().toDateString();
        const todayTasks = tasks.filter(t => t.day === 'today');
        const stat: DayStats = {
          date: todayStr,
          total_count: todayTasks.length,
          done_count: todayTasks.filter(t => t.is_done).length,
          total_minutes: todayTasks.reduce((s, t) => s + t.duration_minutes, 0),
          done_minutes: todayTasks.filter(t => t.is_done).reduce((s, t) => s + t.duration_minutes, 0),
        };
        const filtered = dayHistory.filter(d => d.date !== todayStr);
        set({ dayHistory: [...filtered.slice(-29), stat] });
      },

      loadFromSupabase: async () => {
        const { userId } = get();
        if (!userId) return;
        set({ isLoading: true });
        const [tasksRes, configRes] = await Promise.all([
          supabase.from('tasks').select('*').eq('user_id', userId).order('sort_order'),
          supabase.from('user_config').select('*').eq('user_id', userId).single(),
        ]);
        if (tasksRes.data) set({ tasks: rolloverRecurring(tasksRes.data) });
        if (configRes.data) {
          const { user_id, updated_at, ...cfg } = configRes.data;
          set({ config: { ...DEFAULT_CONFIG, ...cfg } });
        }
        set({ isLoading: false });
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ userId: null, userEmail: null, tasks: [], chatMessages: [] });
      },
    }),
    {
      name: 'upx-store-v2',
      partialize: (s) => ({
        tasks: s.tasks,
        config: s.config,
        chatMessages: s.chatMessages,
        dayHistory: s.dayHistory,
        apiKey: s.apiKey,
        customBaseURL: s.customBaseURL,
        customModel: s.customModel,
      }),
    }
  )
);
