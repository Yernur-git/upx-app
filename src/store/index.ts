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
  language: 'en',
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
  useDefaultKey: boolean;
  chatOpen: boolean;
  activePanel: AppPanel;
  activeChatDay: 'today' | 'tomorrow';
  lastRolloverDate: string | null;
  aiUndoSnapshot: Task[] | null;

  setUserId: (id: string | null) => void;
  setUserEmail: (email: string | null) => void;
  setApiKey: (key: string) => void;
  setCustomBaseURL: (url: string) => void;
  setCustomModel: (model: string) => void;
  /** Switch between default (env-backed proxy) and custom key. CLEARS custom state on switch. */
  setKeyMode: (mode: 'default' | 'custom') => void;
  setChatOpen: (open: boolean) => void;
  setActivePanel: (panel: AppPanel) => void;
  setActiveChatDay: (day: 'today' | 'tomorrow') => void;

  addTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  reorderTasks: (ids: string[]) => Promise<void>;
  moveTask: (id: string, day: 'today' | 'tomorrow') => Promise<void>;

  updateConfig: (updates: Partial<UserConfig>) => Promise<void>;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'created_at'>) => void;
  applyActions: (actions: ParsedAction[]) => Promise<number>;
  undoLastAI: () => Promise<void>;
  saveDayStats: () => void;
  checkAndRollover: () => Promise<void>;

  loadFromSupabase: () => Promise<void>;
  signOut: () => Promise<void>;
}

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

function todayDateStr(): string {
  // ISO date YYYY-MM-DD (locale-independent — was previously toDateString() which is locale-dependent)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Day-rollover: returns the new task list AND a diff so the caller can sync
 * changes back to Supabase. Without that sync, the DB keeps serving yesterday's
 * state on every reload and the UI looks broken.
 */
function rolloverRecurring(tasks: Task[]): {
  kept: Task[];
  drops: string[];                                                // delete from DB
  dayChanges: Array<{ id: string; day: 'today' | 'tomorrow' }>;   // update day in DB
  resetIds: string[];                                             // is_done → false in DB
} {
  const dayOfWeek = new Date().getDay();
  const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;

  const kept: Task[] = [];
  const drops: string[] = [];
  const dayChanges: Array<{ id: string; day: 'today' | 'tomorrow' }> = [];
  const resetIds: string[] = [];

  const appliesToday = (t: Task): boolean =>
    t.recurrence === 'daily' ||
    (t.recurrence === 'weekdays' && isWeekday) ||
    (t.recurrence === 'weekly' && new Date(t.created_at).getDay() === dayOfWeek) ||
    (t.recurrence === 'custom' && (t.recurrence_days?.includes(dayOfWeek) ?? false));

  for (const t of tasks) {
    // Done one-shot today → DROP (DB + local)
    if (t.day === 'today' && t.is_done && t.recurrence === 'none') {
      drops.push(t.id);
      continue;
    }

    // Pending one-shot today → keep
    if (t.day === 'today' && !t.is_done && t.recurrence === 'none') {
      kept.push(t);
      continue;
    }

    // Recurring on today
    if (t.day === 'today' && t.recurrence !== 'none') {
      const yes = appliesToday(t);
      if (yes) {
        if (t.is_done) resetIds.push(t.id);
        kept.push({ ...t, is_done: false });
      } else {
        kept.push({ ...t, day: 'tomorrow', is_done: false });
        dayChanges.push({ id: t.id, day: 'tomorrow' });
        if (t.is_done) resetIds.push(t.id);
      }
      continue;
    }

    // One-shot tomorrow → today (ignore is_done — fresh start)
    if (t.day === 'tomorrow' && t.recurrence === 'none') {
      kept.push({ ...t, day: 'today', is_done: false });
      dayChanges.push({ id: t.id, day: 'today' });
      if (t.is_done) resetIds.push(t.id);
      continue;
    }

    // Recurring tomorrow
    if (t.day === 'tomorrow' && t.recurrence !== 'none') {
      const yes = appliesToday(t);
      if (yes) {
        kept.push({ ...t, day: 'today', is_done: false });
        dayChanges.push({ id: t.id, day: 'today' });
        if (t.is_done) resetIds.push(t.id);
      } else {
        kept.push({ ...t, is_done: false });
        if (t.is_done) resetIds.push(t.id);
      }
      continue;
    }

    kept.push(t);
  }

  return { kept, drops, dayChanges, resetIds };
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
      useDefaultKey: true,
      chatOpen: false,
      activePanel: 'plan',
      activeChatDay: 'today',
      lastRolloverDate: null,
      aiUndoSnapshot: null,

      setUserId: (id) => set({ userId: id }),
      setUserEmail: (email) => set({ userEmail: email }),
      setApiKey: (key) => set({ apiKey: key }),
      setCustomBaseURL: (url) => set({ customBaseURL: url }),
      setCustomModel: (model) => set({ customModel: model }),
      setKeyMode: (mode) => {
        // Mandatory state cleanup on every switch — prevents stale credentials
        // from leaking between modes. Always clear, regardless of direction.
        set({
          useDefaultKey: mode === 'default',
          apiKey: '',
          customBaseURL: '',
          customModel: '',
        });
      },
      setChatOpen: (open) => set({ chatOpen: open }),
      setActivePanel: (panel) => set({ activePanel: panel }),
      setActiveChatDay: (day) => set({ activeChatDay: day }),

      checkAndRollover: async () => {
        const today = todayDateStr();
        const { lastRolloverDate, tasks, userId, dayHistory } = get();
        const isISO = lastRolloverDate && /^\d{4}-\d{2}-\d{2}$/.test(lastRolloverDate);
        if (isISO && lastRolloverDate === today) return;

        // Snapshot the OLD day's stats under the OLD date (not today!).
        // Previous bug: saveDayStats used today's date, so the new day's slot
        // got polluted with yesterday's task list.
        if (lastRolloverDate && /^\d{4}-\d{2}-\d{2}$/.test(lastRolloverDate)) {
          const oldDayTasks = tasks.filter(t => t.day === 'today');
          const stat: DayStats = {
            date: lastRolloverDate,
            total_count: oldDayTasks.length,
            done_count: oldDayTasks.filter(t => t.is_done).length,
            total_minutes: oldDayTasks.reduce((s, t) => s + t.duration_minutes, 0),
            done_minutes: oldDayTasks.filter(t => t.is_done).reduce((s, t) => s + t.duration_minutes, 0),
            tasks: oldDayTasks.map(t => ({
              id: t.id, title: t.title, category: t.category,
              duration_minutes: t.duration_minutes, is_done: t.is_done,
            })),
          };
          const filtered = dayHistory.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date !== lastRolloverDate);
          set({ dayHistory: [...filtered.slice(-29), stat] });
          if (userId && userId !== 'local-user') {
            supabase.from('day_stats').upsert({
              user_id: userId, date: stat.date,
              total_count: stat.total_count, done_count: stat.done_count,
              total_minutes: stat.total_minutes, done_minutes: stat.done_minutes,
              tasks: stat.tasks,
            }, { onConflict: 'user_id,date' }).then(({ error }) => {
              if (error) console.error('[rollover] day_stats upsert failed', error);
            });
          }
        }

        const { kept, drops, dayChanges, resetIds } = rolloverRecurring(tasks);
        set({ tasks: kept, lastRolloverDate: today });

        // Sync the rollover diff to Supabase. Without this, the DB keeps
        // serving yesterday's state on every reload — done tasks "come back".
        if (userId && userId !== 'local-user') {
          try {
            if (drops.length > 0) {
              await supabase.from('tasks').delete().in('id', drops).eq('user_id', userId);
            }
            // Use a single-row update per change — Supabase doesn't bulk-update with different values
            for (const ch of dayChanges) {
              await supabase.from('tasks').update({ day: ch.day, is_done: false }).eq('id', ch.id).eq('user_id', userId);
            }
            // Recurring resets that didn't already get covered by dayChanges
            const dayChangedIds = new Set(dayChanges.map(c => c.id));
            const onlyResets = resetIds.filter(id => !dayChangedIds.has(id));
            if (onlyResets.length > 0) {
              await supabase.from('tasks').update({ is_done: false }).in('id', onlyResets).eq('user_id', userId);
            }
          } catch (e) {
            console.error('[rollover] sync failed', e);
          }
        }
      },

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
        if (userId && userId !== 'local-user') {
          // Explicit column list to avoid schema mismatch errors
          const row = {
            id: task.id,
            user_id: userId,
            title: task.title,
            duration_minutes: task.duration_minutes,
            break_after: task.break_after,
            travel_minutes: task.travel_minutes,
            priority: task.priority,
            category: task.category,
            is_starred: task.is_starred,
            is_done: task.is_done,
            day: task.day,
            fixed_time: task.fixed_time ?? null,
            notes: task.notes ?? null,
            sort_order: task.sort_order,
            created_at: task.created_at,
            recurrence: task.recurrence,
            recurrence_days: task.recurrence_days ?? null,
          };
          const { error } = await supabase.from('tasks').insert(row);
          if (error) {
            set(s => ({ tasks: s.tasks.filter(t => t.id !== task.id) }));
            throw new Error(error.message);
          }
        }
        return task;
      },

      updateTask: async (id, updates) => {
        const prev = get().tasks.find(t => t.id === id);
        if (!prev) return;
        set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t) }));
        const { userId } = get();
        if (userId && userId !== 'local-user') {
          // Strip any undefined values before sending to Supabase
          const safeUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
          );
          const { error } = await supabase.from('tasks').update(safeUpdates).eq('id', id).eq('user_id', userId);
          if (error) {
            set(s => ({ tasks: s.tasks.map(t => t.id === id ? prev : t) }));
            throw new Error(error.message);
          }
        }
      },

      deleteTask: async (id) => {
        const prev = get().tasks.find(t => t.id === id);
        if (!prev) return;
        set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }));
        const { userId } = get();
        if (userId) {
          const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
          if (error) {
            set(s => ({ tasks: [...s.tasks, prev] }));
            throw new Error(error.message);
          }
        }
      },

      toggleDone: async (id) => {
        const task = get().tasks.find(t => t.id === id);
        if (!task) return;
        await get().updateTask(id, { is_done: !task.is_done });
      },

      reorderTasks: async (orderedIds) => {
        const prevTasks = get().tasks;
        set(s => {
          const taskMap = new Map(s.tasks.map(t => [t.id, t]));
          const reordered = orderedIds
            .map((id, i) => taskMap.has(id) ? { ...taskMap.get(id)!, sort_order: i } : null)
            .filter(Boolean) as Task[];
          const rest = s.tasks.filter(t => !orderedIds.includes(t.id));
          return { tasks: [...reordered, ...rest] };
        });
        const { userId } = get();
        if (userId) {
          // Single upsert instead of N individual updates
          const upsertRows = orderedIds.map((id, i) => ({ id, user_id: userId, sort_order: i }));
          const { error } = await supabase
            .from('tasks')
            .upsert(upsertRows, { onConflict: 'id' });
          if (error) {
            set({ tasks: prevTasks }); // rollback
            console.error('reorderTasks failed, rolled back:', error.message);
          }
        }
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
        set({ aiUndoSnapshot: get().tasks });
        let applied = 0;
        for (const action of actions) {
          if (!action?.type || action?.payload == null) continue;
          const { addTask, updateTask, deleteTask, moveTask, reorderTasks } = get();
          try {
            switch (action.type) {
              case 'create_task': {
                const p = action.payload as Partial<Omit<Task, 'id' | 'created_at'>>;
                if (!p?.title) break;
                await addTask({
                  title: p.title ?? 'Untitled',
                  duration_minutes: p.duration_minutes ?? 30,
                  break_after: p.break_after ?? get().config.buffer,
                  travel_minutes: p.travel_minutes ?? 0,
                  priority: p.priority ?? 'medium',
                  category: p.category ?? 'general',
                  is_starred: p.is_starred ?? false,
                  is_done: false,
                  day: p.day ?? 'today',
                  recurrence: p.recurrence ?? 'none',
                  sort_order: p.sort_order ?? 0,
                  fixed_time: p.fixed_time,
                  notes: p.notes,
                });
                applied++;
                break;
              }
              case 'update_task': {
                const pl = action.payload as Record<string, unknown>;
                if (!pl?.id || typeof pl.id !== 'string') break;
                if (!get().tasks.find(t => t.id === pl.id)) { console.warn('update_task: unknown id', pl.id); break; }
                const { id, ...updates } = pl;
                await updateTask(id as string, updates as Partial<Task>);
                applied++;
                break;
              }
              case 'delete_task': {
                const pl = action.payload as Record<string, unknown>;
                if (!pl?.id || typeof pl.id !== 'string') break;
                if (!get().tasks.find(t => t.id === pl.id)) { console.warn('delete_task: unknown id', pl.id); break; }
                await deleteTask(pl.id as string);
                applied++;
                break;
              }
              case 'move_task': {
                const pl = action.payload as Record<string, unknown>;
                if (!pl?.id || typeof pl.id !== 'string' || !pl?.day) break;
                if (!get().tasks.find(t => t.id === pl.id)) { console.warn('move_task: unknown id', pl.id); break; }
                await moveTask(pl.id as string, pl.day as 'today' | 'tomorrow');
                applied++;
                break;
              }
              case 'reschedule': {
                const pl = action.payload as Record<string, unknown>;
                if (!Array.isArray(pl?.order) || pl.order.length === 0) break;
                await reorderTasks(pl.order as string[]);
                applied++;
                break;
              }
            }
          } catch(e) { console.error('Action failed:', action.type, e); }
        }
        return applied;
      },

      undoLastAI: async () => {
        const { aiUndoSnapshot, userId } = get();
        if (!aiUndoSnapshot) return;
        set({ tasks: aiUndoSnapshot, aiUndoSnapshot: null });
        if (userId) {
          await supabase.from('tasks').delete().eq('user_id', userId);
          if (aiUndoSnapshot.length > 0) {
            await supabase.from('tasks').insert(
              aiUndoSnapshot.map(t => ({ ...t, user_id: userId }))
            );
          }
        }
      },

      saveDayStats: () => {
        const { tasks, dayHistory, lastRolloverDate, userId } = get();
        const todayStr = todayDateStr();
        // Skip until checkAndRollover has run for today. Otherwise we snapshot
        // yesterday's leftover "today" tasks under today's date and corrupt stats.
        if (lastRolloverDate !== todayStr) return;
        const todayTasks = tasks.filter(t => t.day === 'today');
        const stat: DayStats = {
          date: todayStr,
          total_count: todayTasks.length,
          done_count: todayTasks.filter(t => t.is_done).length,
          total_minutes: todayTasks.reduce((s, t) => s + t.duration_minutes, 0),
          done_minutes: todayTasks.filter(t => t.is_done).reduce((s, t) => s + t.duration_minutes, 0),
          tasks: todayTasks.map(t => ({
            id: t.id, title: t.title, category: t.category,
            duration_minutes: t.duration_minutes, is_done: t.is_done,
          })),
        };
        const filtered = dayHistory.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date !== todayStr);
        set({ dayHistory: [...filtered.slice(-29), stat] });
        if (userId && userId !== 'local-user') {
          supabase.from('day_stats').upsert({
            user_id: userId, date: stat.date,
            total_count: stat.total_count, done_count: stat.done_count,
            total_minutes: stat.total_minutes, done_minutes: stat.done_minutes,
            tasks: stat.tasks,
          }, { onConflict: 'user_id,date' }).then(({ error }) => {
            if (error) console.error('[saveDayStats] supabase error', error);
          });
        }
      },

      loadFromSupabase: async () => {
        const { userId } = get();
        if (!userId) return;
        set({ isLoading: true });
        const [tasksRes, configRes, statsRes] = await Promise.all([
          supabase.from('tasks').select('*').eq('user_id', userId).order('sort_order'),
          supabase.from('user_config').select('*').eq('user_id', userId).single(),
          supabase.from('day_stats').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
        ]);
        if (tasksRes.data) set({ tasks: tasksRes.data });
        if (configRes.data) {
          const { user_id, updated_at, ...cfg } = configRes.data;
          set({ config: { ...DEFAULT_CONFIG, ...cfg } });
        }
        if (statsRes.data && statsRes.data.length > 0) {
          const remoteStats: DayStats[] = statsRes.data.map(r => ({
            date: r.date,
            total_count: r.total_count,
            done_count: r.done_count,
            total_minutes: r.total_minutes,
            done_minutes: r.done_minutes,
            tasks: r.tasks || [],
          }));
          // Merge remote into local — remote wins for same date
          const { dayHistory } = get();
          const merged = new Map<string, DayStats>(dayHistory.map(d => [d.date, d]));
          for (const r of remoteStats) merged.set(r.date, r);
          set({ dayHistory: [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30) });
        }
        set({ isLoading: false });
        get().checkAndRollover();
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ userId: null, userEmail: null, tasks: [], chatMessages: [], aiUndoSnapshot: null });
      },
    }),
    {
      name: 'upx-store-v3',
      partialize: (s) => ({
        tasks: s.tasks,
        config: s.config,
        chatMessages: s.chatMessages,
        dayHistory: s.dayHistory,
        apiKey: s.apiKey,
        customBaseURL: s.customBaseURL,
        customModel: s.customModel,
        useDefaultKey: s.useDefaultKey,
        lastRolloverDate: s.lastRolloverDate,
      }),
    }
  )
);