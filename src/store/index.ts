import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, UserConfig, ChatMessage, ParsedAction, AppPanel, DayStats, DayCheckin, FocusSession } from '../types';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';

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
  quick_tasks: [
    { id: 'qt-1', emoji: 'Dumbbell',  title: 'Training',   duration_minutes: 60,  category: 'workout',    priority: 'high'   },
    { id: 'qt-2', emoji: 'Monitor',   title: 'Deep Work',  duration_minutes: 90,  category: 'deep work',  priority: 'high'   },
    { id: 'qt-3', emoji: 'Calendar',  title: 'Meeting',    duration_minutes: 30,  category: 'general',    priority: 'medium' },
    { id: 'qt-4', emoji: 'BookOpen',  title: 'Reading',    duration_minutes: 30,  category: 'reading',    priority: 'low'    },
    { id: 'qt-5', emoji: 'Wind',      title: 'Meditation', duration_minutes: 20,  category: 'meditation', priority: 'low'    },
    { id: 'qt-6', emoji: 'Footprints',title: 'Walk',       duration_minutes: 30,  category: 'general',    priority: 'low'    },
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
  lastMorningBriefDate: string | null;
  lastEveningPromptDate: string | null;
  aiUndoSnapshot: Task[] | null;
  lastLoadedUserId: string | null;
  todayCheckin: DayCheckin | null;
  lastCheckinDate: string | null;
  lastMidCheckinDate: string | null;
  lastEveningCheckinDate: string | null;
  todayMidEnergy: number | null;
  todayEveningMood: string | null;  // 'great' | 'ok' | 'rough'

  // Focus timer
  focusSession: FocusSession | null;
  startFocus: (task: Task) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: () => void;
  addFocusTime: (ms: number) => void;

  dismissCheckin: () => void;
  setMidCheckin: (energy: number) => void;
  dismissMidCheckin: () => void;
  setEveningCheckin: (mood: string) => void;
  dismissEveningCheckin: () => void;

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
  setLastMorningBriefDate: (date: string) => void;
  setLastEveningPromptDate: (date: string) => void;
  pendingChatInput: string;
  setPendingChatInput: (s: string) => void;
  setCheckin: (c: DayCheckin) => void;

  addTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  reorderTasks: (ids: string[]) => Promise<void>;
  moveTask: (id: string, day: 'today' | 'tomorrow') => Promise<void>;

  updateConfig: (updates: Partial<UserConfig>) => Promise<void>;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'created_at'>) => void;
  deleteAllTasks: () => Promise<void>;
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
  const today = todayDateStr();
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
      // Don't promote if task is scheduled for a FUTURE specific date.
      // Use > today (not !== today) so past/overdue planned_dates still roll over.
      if (t.planned_date && t.planned_date > today) {
        kept.push(t);
        continue;
      }
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
      // API keys read from sessionStorage so they're never written to localStorage
      apiKey:        (() => { try { return sessionStorage.getItem('upx_apikey') ?? ''; } catch { return ''; } })(),
      customBaseURL: (() => { try { return sessionStorage.getItem('upx_baseurl') ?? ''; } catch { return ''; } })(),
      customModel:   (() => { try { return sessionStorage.getItem('upx_model') ?? ''; } catch { return ''; } })(),
      useDefaultKey: (() => { try { return sessionStorage.getItem('upx_defaultkey') !== 'false'; } catch { return true; } })(),
      chatOpen: false,
      activePanel: 'plan',
      activeChatDay: 'today',
      lastRolloverDate: null,
      lastMorningBriefDate: null,
      lastEveningPromptDate: null,
      aiUndoSnapshot: null,
      lastLoadedUserId: null,
      todayCheckin: null,
      lastCheckinDate: null,
      lastMidCheckinDate: null,
      lastEveningCheckinDate: null,
      todayMidEnergy: null,
      todayEveningMood: null,
      focusSession: null,
      pendingChatInput: '',

      setUserId: (id) => set({ userId: id }),
      setUserEmail: (email) => set({ userEmail: email }),
      setApiKey: (key) => {
        try { sessionStorage.setItem('upx_apikey', key); } catch { /* private mode */ }
        set({ apiKey: key });
      },
      setCustomBaseURL: (url) => {
        try { sessionStorage.setItem('upx_baseurl', url); } catch { /* private mode */ }
        set({ customBaseURL: url });
      },
      setCustomModel: (model) => {
        try { sessionStorage.setItem('upx_model', model); } catch { /* private mode */ }
        set({ customModel: model });
      },
      setKeyMode: (mode) => {
        // Mandatory state cleanup on every switch — prevents stale credentials
        // from leaking between modes. Always clear, regardless of direction.
        try {
          sessionStorage.setItem('upx_defaultkey', String(mode === 'default'));
          sessionStorage.removeItem('upx_apikey');
          sessionStorage.removeItem('upx_baseurl');
          sessionStorage.removeItem('upx_model');
        } catch { /* private mode */ }
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
      setLastMorningBriefDate: (date) => set({ lastMorningBriefDate: date }),
      setLastEveningPromptDate: (date) => set({ lastEveningPromptDate: date }),
      setPendingChatInput: (s) => set({ pendingChatInput: s }),
      setCheckin: (c) => set({ todayCheckin: c, lastCheckinDate: todayDateStr() }),
      dismissCheckin: () => set({ lastCheckinDate: todayDateStr() }),
      setMidCheckin: (energy) => set({ todayMidEnergy: energy, lastMidCheckinDate: todayDateStr() }),
      dismissMidCheckin: () => set({ lastMidCheckinDate: todayDateStr() }),
      setEveningCheckin: (mood) => set({ todayEveningMood: mood, lastEveningCheckinDate: todayDateStr() }),
      dismissEveningCheckin: () => set({ lastEveningCheckinDate: todayDateStr() }),

      // ── Focus timer ────────────────────────────────────────────────
      startFocus: (task) => set({
        focusSession: {
          taskId: task.id,
          taskTitle: task.title,
          durationMs: task.duration_minutes * 60 * 1000,
          startedAt: Date.now(),
          pausedAt: null,
          pausedMs: 0,
        },
      }),
      pauseFocus: () => {
        const { focusSession } = get();
        if (!focusSession || focusSession.pausedAt) return;
        set({ focusSession: { ...focusSession, pausedAt: Date.now() } });
      },
      resumeFocus: () => {
        const { focusSession } = get();
        if (!focusSession || !focusSession.pausedAt) return;
        set({ focusSession: { ...focusSession, pausedAt: null, pausedMs: focusSession.pausedMs + (Date.now() - focusSession.pausedAt) } });
      },
      stopFocus: () => {
        const { focusSession, dayHistory } = get();
        if (focusSession) {
          // Compute actual elapsed time (exclude paused time)
          const snapNow = focusSession.pausedAt ?? Date.now();
          const elapsedMs = snapNow - focusSession.startedAt - focusSession.pausedMs;
          const elapsedMin = Math.max(0, Math.round(elapsedMs / 60000));
          if (elapsedMin > 0) {
            const today = todayDateStr();
            const existing = dayHistory.find(d => d.date === today);
            if (existing) {
              const updated = dayHistory.map(d =>
                d.date === today
                  ? { ...d, focus_minutes: (d.focus_minutes ?? 0) + elapsedMin }
                  : d
              );
              set({ dayHistory: updated });
            } else {
              // No entry yet for today — create a stub that will be filled by saveDayStats
              set({ dayHistory: [...dayHistory, {
                date: today, total_count: 0, done_count: 0,
                total_minutes: 0, done_minutes: 0, focus_minutes: elapsedMin,
              }] });
            }
          }
        }
        set({ focusSession: null });
      },
      addFocusTime: (ms) => {
        const { focusSession } = get();
        if (!focusSession) return;
        set({ focusSession: { ...focusSession, durationMs: focusSession.durationMs + ms } });
      },

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
            planned_date: task.planned_date ?? null,
          };
          const { error } = await supabase.from('tasks').insert(row);
          if (error) {
            set(s => ({ tasks: s.tasks.filter(t => t.id !== task.id) }));
            throw new Error(error.message);
          }
        }
        track('task_added', { day: task.day, priority: task.priority, has_fixed_time: !!task.fixed_time });
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

      deleteAllTasks: async () => {
        const { userId } = get();
        set({ tasks: [] });
        if (userId) {
          await supabase.from('tasks').delete().eq('user_id', userId);
        }
      },

      toggleDone: async (id) => {
        const task = get().tasks.find(t => t.id === id);
        if (!task) return;
        await get().updateTask(id, { is_done: !task.is_done });
        if (!task.is_done) track('task_completed', { category: task.category, duration_minutes: task.duration_minutes });
      },

      reorderTasks: async (orderedIds) => {
        // Apply optimistic update immediately — local state is authoritative for order.
        // Do NOT rollback on Supabase failure: sort_order is also persisted in
        // localStorage, so the user's drag sticks even if the DB sync fails.
        set(s => {
          const taskMap = new Map(s.tasks.map(t => [t.id, t]));
          const reordered = orderedIds
            .map((id, i) => taskMap.has(id) ? { ...taskMap.get(id)!, sort_order: i } : null)
            .filter(Boolean) as Task[];
          // Done tasks not in orderedIds get sort_orders starting AFTER all pending tasks
          // so that if they are later unchecked they appear at the end, not at a
          // conflicting position with pending tasks.
          const rest = s.tasks
            .filter(t => !orderedIds.includes(t.id))
            .map((t, i) => ({ ...t, sort_order: orderedIds.length + i }));
          return { tasks: [...reordered, ...rest] };
        });
        const { userId } = get();
        if (userId && userId !== 'local-user') {
          // Update each row individually to avoid sort_order unique-constraint
          // violations that can happen when a batch upsert tries to assign values
          // that other rows still hold (e.g. swapping 0↔2 hits a conflict mid-batch).
          // Fire all updates in parallel — no rollback on failure.
          const updates = orderedIds.map((id, i) =>
            supabase.from('tasks')
              .update({ sort_order: i })
              .eq('id', id)
              .eq('user_id', userId)
              .then(({ error }) => {
                if (error) console.error('[reorderTasks] update failed for', id, error.message);
              })
          );
          await Promise.all(updates);
        }
      },

      moveTask: async (id, day) => {
        await get().updateTask(id, { day });
      },

      updateConfig: async (updates) => {
        set(s => ({ config: { ...s.config, ...updates } }));
        const { userId, config } = get();
        if (userId) {
          const merged = { ...config, ...updates };
          // Use an EXPLICIT payload — never spread the whole config object.
          // If ANY unknown column is included, PostgREST rejects the entire upsert
          // silently (all settings stop syncing). Explicit list = safe by default.
          // To enable quick_tasks / peak_focus_time sync, run the SQL migration first:
          //   ALTER TABLE user_config
          //     ADD COLUMN IF NOT EXISTS morning_buffer   integer DEFAULT 15,
          //     ADD COLUMN IF NOT EXISTS road_time_minutes integer DEFAULT 20,
          //     ADD COLUMN IF NOT EXISTS known_contexts   jsonb   DEFAULT '{}',
          //     ADD COLUMN IF NOT EXISTS quick_tasks      jsonb,
          //     ADD COLUMN IF NOT EXISTS peak_focus_time  text;
          const payload: Record<string, unknown> = {
            user_id:            userId,
            wake:               merged.wake,
            sleep:              merged.sleep,
            buffer:             merged.buffer,
            morning_buffer:     merged.morning_buffer,
            theme:              merged.theme,
            language:           merged.language,
            road_time_minutes:  merged.road_time_minutes,
            known_contexts:     merged.known_contexts,
            category_goals:     merged.category_goals,
            peak_focus_time:    merged.peak_focus_time,
            quick_tasks:        merged.quick_tasks,
          };
          const { error } = await supabase.from('user_config').upsert(payload);
          if (error) console.error('[updateConfig] Supabase error:', error.message, payload);
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
                // Support both full UUID and 8-char short ID (prefix match)
                const utask = get().tasks.find(t => t.id === pl.id || t.id.startsWith(pl.id as string));
                if (!utask) { console.warn('update_task: unknown id', pl.id); break; }
                const { id: _id, ...updates } = pl;
                await updateTask(utask.id, updates as Partial<Task>);
                applied++;
                break;
              }
              case 'delete_task': {
                const pl = action.payload as Record<string, unknown>;
                if (!pl?.id || typeof pl.id !== 'string') break;
                // Support both full UUID and 8-char short ID (prefix match)
                const dtask = get().tasks.find(t => t.id === pl.id || t.id.startsWith(pl.id as string));
                if (!dtask) { console.warn('delete_task: unknown id', pl.id); break; }
                await deleteTask(dtask.id);
                applied++;
                break;
              }
              case 'move_task': {
                const pl = action.payload as Record<string, unknown>;
                if (!pl?.id || typeof pl.id !== 'string' || !pl?.day) break;
                const mtask = get().tasks.find(t => t.id === pl.id || t.id.startsWith(pl.id as string));
                if (!mtask) { console.warn('move_task: unknown id', pl.id); break; }
                await moveTask(mtask.id, pl.day as 'today' | 'tomorrow');
                applied++;
                break;
              }
              case 'reschedule': {
                const pl = action.payload as Record<string, unknown>;
                if (!Array.isArray(pl?.order) || pl.order.length === 0) break;
                // Resolve short IDs to full IDs for reschedule
                const tasks = get().tasks;
                const resolvedOrder = (pl.order as string[]).map(shortId => {
                  const t = tasks.find(t => t.id === shortId || t.id.startsWith(shortId));
                  return t ? t.id : shortId;
                });
                await reorderTasks(resolvedOrder);
                applied++;
                break;
              }
            }
          } catch(e) { console.error('Action failed:', action.type, e); }
        }
        if (applied > 0) track('ai_actions_applied', { count: applied });
        return applied;
      },

      undoLastAI: async () => {
        const { aiUndoSnapshot, tasks: currentTasks, userId } = get();
        if (!aiUndoSnapshot) return;
        set({ tasks: aiUndoSnapshot, aiUndoSnapshot: null });
        if (userId && userId !== 'local-user') {
          // Diff instead of delete-all: only touch tasks that actually changed.
          // Prevents manually-added tasks (between AI action and undo) from being lost.
          const snapIds  = new Set(aiUndoSnapshot.map(t => t.id));
          const currIds  = new Set(currentTasks.map(t => t.id));
          // AI created these → delete them
          const toDelete = currentTasks.filter(t => !snapIds.has(t.id));
          // AI deleted these → re-insert them
          const toInsert = aiUndoSnapshot.filter(t => !currIds.has(t.id));
          // AI modified these → restore snapshot version
          const toUpdate = aiUndoSnapshot.filter(t => currIds.has(t.id));
          if (toDelete.length > 0) {
            await supabase.from('tasks').delete().in('id', toDelete.map(t => t.id));
          }
          if (toInsert.length > 0) {
            await supabase.from('tasks').insert(toInsert.map(t => ({ ...t, user_id: userId })));
          }
          for (const t of toUpdate) {
            await supabase.from('tasks')
              .update({ ...t, user_id: userId })
              .eq('id', t.id).eq('user_id', userId);
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
        // Preserve accumulated focus_minutes from stopFocus calls
        const existingToday = dayHistory.find(d => d.date === todayStr);
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
          ...(existingToday?.focus_minutes ? { focus_minutes: existingToday.focus_minutes } : {}),
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
        const { userId, lastLoadedUserId } = get();
        if (!userId) return;

        // Different user → wipe ALL local state before loading so account A's
        // data never bleeds into account B's session.
        if (lastLoadedUserId && lastLoadedUserId !== userId) {
          set({
            tasks: [],
            config: DEFAULT_CONFIG,
            dayHistory: [],
            chatMessages: [],
            aiUndoSnapshot: null,
            lastRolloverDate: null,
            lastMorningBriefDate: null,
            lastEveningPromptDate: null,
          });
        }

        set({ isLoading: true });
        const [tasksRes, configRes, statsRes] = await Promise.all([
          supabase.from('tasks').select('*').eq('user_id', userId).order('sort_order'),
          supabase.from('user_config').select('*').eq('user_id', userId).single(),
          supabase.from('day_stats').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
        ]);
        if (tasksRes.data) {
          // Only convert 'tomorrow' → 'today' if the calendar day has actually changed
          // (i.e. lastRolloverDate is not today). This prevents overwriting intentional
          // "move to tomorrow" when the user is still on the same day.
          const today = todayDateStr();
          const { lastRolloverDate } = get();
          const needsRollover = !lastRolloverDate || lastRolloverDate !== today;

          const tomorrowIds: string[] = [];
          const normalised = tasksRes.data.map(t => {
            if (t.day === 'tomorrow' && needsRollover && !(t.planned_date && t.planned_date > today)) {
              tomorrowIds.push(t.id);
              return { ...t, day: 'today' as const, is_done: false };
            }
            return t;
          });
          set({ tasks: normalised });
          // Sync the rollover back to Supabase
          if (tomorrowIds.length > 0 && userId) {
            for (const id of tomorrowIds) {
              supabase.from('tasks')
                .update({ day: 'today', is_done: false })
                .eq('id', id).eq('user_id', userId)
                .then(({ error }) => { if (error) console.error('[load] tomorrow→today sync failed', error); });
            }
          }
        }
        if (configRes.data) {
          const { user_id, updated_at, ...cfg } = configRes.data;
          // Strip null values so they don't override DEFAULT_CONFIG fallbacks.
          // e.g. quick_tasks column is NULL for existing users after migration →
          // without this, null would overwrite the default template list.
          const cleanCfg = Object.fromEntries(
            Object.entries(cfg).filter(([, v]) => v !== null)
          );
          set({ config: { ...DEFAULT_CONFIG, ...cleanCfg } });
        }
        {
          const remoteStats: DayStats[] = (statsRes.data ?? []).map(r => ({
            date: r.date,
            total_count: r.total_count,
            done_count: r.done_count,
            total_minutes: r.total_minutes,
            done_minutes: r.done_minutes,
            tasks: r.tasks || [],
          }));
          // For same user: merge (remote wins same date). For new user: only remote.
          const isSameUser = get().lastLoadedUserId === userId;
          if (isSameUser && remoteStats.length > 0) {
            const { dayHistory } = get();
            const merged = new Map<string, DayStats>(dayHistory.map(d => [d.date, d]));
            for (const r of remoteStats) merged.set(r.date, r);
            set({ dayHistory: [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30) });
          } else {
            // Different (or new) user — use only what Supabase returned
            set({ dayHistory: remoteStats.sort((a, b) => a.date.localeCompare(b.date)) });
          }
        }
        set({ isLoading: false, lastLoadedUserId: userId });
        get().checkAndRollover();
      },

      signOut: async () => {
        track('signed_out');
        await supabase.auth.signOut();
        // Full wipe — next login starts clean regardless of who logs in next
        set({
          userId: null,
          userEmail: null,
          tasks: [],
          config: DEFAULT_CONFIG,
          dayHistory: [],
          chatMessages: [],
          aiUndoSnapshot: null,
          lastLoadedUserId: null,
          lastRolloverDate: null,
          lastMorningBriefDate: null,
          lastEveningPromptDate: null,
        });
      },
    }),
    {
      name: 'upx-store-v3',
      partialize: (s) => ({
        tasks: s.tasks,
        config: s.config,
        // chatMessages intentionally NOT persisted — each session starts fresh
        // so AI context is consistent across all devices
        dayHistory: s.dayHistory,
        // apiKey/customBaseURL/customModel/useDefaultKey intentionally NOT persisted
        // — stored in sessionStorage instead so they clear when the browser closes
        lastRolloverDate: s.lastRolloverDate,
        lastMorningBriefDate: s.lastMorningBriefDate,
        lastEveningPromptDate: s.lastEveningPromptDate,
        lastLoadedUserId: s.lastLoadedUserId,
        // Checkin guards — persisted so banners don't reappear on every page reload
        lastCheckinDate: s.lastCheckinDate,
        lastMidCheckinDate: s.lastMidCheckinDate,
        lastEveningCheckinDate: s.lastEveningCheckinDate,
        todayCheckin: s.todayCheckin,
        todayMidEnergy: s.todayMidEnergy,
        todayEveningMood: s.todayEveningMood,
      }),
    }
  )
);