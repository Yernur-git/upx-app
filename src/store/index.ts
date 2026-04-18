import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, UserConfig, ChatMessage, ParsedAction } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_CONFIG: UserConfig = {
  wake: '07:00',
  sleep: '23:00',
  buffer: 5,
  theme: 'light',
  gym_travel_minutes: 20,
  known_contexts: { gym: 20, office: 30, university: 25 },
};

interface Store {
  tasks: Task[];
  config: UserConfig;
  chatMessages: ChatMessage[];
  isLoading: boolean;
  userId: string | null;
  apiKey: string;
  chatOpen: boolean;

  // Actions
  setUserId: (id: string | null) => void;
  setApiKey: (key: string) => void;
  setChatOpen: (open: boolean) => void;

  addTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  reorderTasks: (ids: string[]) => void;
  moveTask: (id: string, day: 'today' | 'tomorrow') => Promise<void>;

  updateConfig: (updates: Partial<UserConfig>) => Promise<void>;

  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'created_at'>) => void;
  applyActions: (actions: ParsedAction[]) => Promise<void>;

  loadFromSupabase: () => Promise<void>;
  syncTask: (task: Task) => Promise<void>;
}

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      tasks: [],
      config: DEFAULT_CONFIG,
      chatMessages: [],
      isLoading: false,
      userId: null,
      apiKey: '',
      chatOpen: false,

      setUserId: (id) => set({ userId: id }),
      setApiKey: (key) => set({ apiKey: key }),
      setChatOpen: (open) => set({ chatOpen: open }),

      addTask: async (taskData) => {
        const task: Task = {
          ...taskData,
          id: generateId(),
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
        set(s => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
        }));
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

      reorderTasks: (ids) => {
        const taskMap = new Map(get().tasks.map(t => [t.id, t]));
        const reordered = ids.map(id => taskMap.get(id)).filter(Boolean) as Task[];
        const rest = get().tasks.filter(t => !ids.includes(t.id));
        set({ tasks: [...reordered, ...rest] });
      },

      moveTask: async (id, day) => {
        await get().updateTask(id, { day });
      },

      updateConfig: async (updates) => {
        set(s => ({ config: { ...s.config, ...updates } }));
        const { userId } = get();
        if (userId) {
          await supabase.from('user_config').upsert({ ...get().config, user_id: userId });
        }
      },

      addChatMessage: (msg) => {
        const message: ChatMessage = {
          ...msg,
          id: generateId(),
          created_at: new Date().toISOString(),
        };
        set(s => ({ chatMessages: [...s.chatMessages.slice(-50), message] }));
      },

      applyActions: async (actions) => {
        for (const action of actions) {
          const { addTask, updateTask, deleteTask, moveTask, reorderTasks } = get();
          switch (action.type) {
            case 'create_task': {
              const p = action.payload as Omit<Task, 'id' | 'created_at'>;
              await addTask({ ...p, is_done: false });
              break;
            }
            case 'update_task': {
              const { id, ...updates } = action.payload as { id: string } & Partial<Task>;
              await updateTask(id, updates);
              break;
            }
            case 'delete_task': {
              const { id } = action.payload as { id: string };
              await deleteTask(id);
              break;
            }
            case 'move_task': {
              const { id, day } = action.payload as { id: string; day: 'today' | 'tomorrow' };
              await moveTask(id, day);
              break;
            }
            case 'reschedule': {
              const { order } = action.payload as { order: string[] };
              reorderTasks(order);
              break;
            }
          }
        }
      },

      loadFromSupabase: async () => {
        const { userId } = get();
        if (!userId) return;
        set({ isLoading: true });

        const [tasksRes, configRes] = await Promise.all([
          supabase.from('tasks').select('*').eq('user_id', userId).order('sort_order'),
          supabase.from('user_config').select('*').eq('user_id', userId).single(),
        ]);

        if (tasksRes.data) set({ tasks: tasksRes.data });
        if (configRes.data) {
          const { user_id, updated_at, ...cfg } = configRes.data;
          set({ config: { ...DEFAULT_CONFIG, ...cfg } });
        }
        set({ isLoading: false });
      },

      syncTask: async (task) => {
        const { userId } = get();
        if (!userId) return;
        await supabase.from('tasks').upsert({ ...task, user_id: userId });
      },
    }),
    {
      name: 'upx-store',
      partialize: (s) => ({
        tasks: s.tasks,
        config: s.config,
        chatMessages: s.chatMessages,
        apiKey: s.apiKey,
      }),
    }
  )
);
