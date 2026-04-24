import type { Task, UserConfig, ChatMessage, ParsedAction } from '../types';
import { minutesToTime, buildSchedule, formatDuration } from './scheduler';

export type AIProvider = 'anthropic' | 'openai' | 'openrouter' | 'groq' | 'custom';

export interface AIConfig {
  apiKey: string;
  provider: AIProvider;
  baseURL?: string;
  model?: string;
}

export function detectProvider(apiKey: string, customBaseURL?: string): AIProvider {
  if (customBaseURL?.includes('openrouter.ai')) return 'openrouter';
  if (customBaseURL && customBaseURL.length > 0) return 'custom';
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('sk-or-')) return 'openrouter';
  if (apiKey.startsWith('gsk_')) return 'groq';
  if (apiKey.startsWith('sk-')) return 'openai';
  return 'custom';
}

export function providerLabel(provider: AIProvider): string {
  return {
    anthropic:  '✓ Claude (Anthropic)',
    openai:     '✓ GPT-4o (OpenAI)',
    openrouter: '✓ OpenRouter',
    groq:       '✓ Groq (free)',
    custom:     '✓ Custom endpoint',
  }[provider];
}

function defaultModel(provider: AIProvider): string {
  return {
    anthropic:  'claude-sonnet-4-20250514',
    openai:     'gpt-4o-mini',
    openrouter: 'openai/gpt-4o-mini',
    groq:       'llama-3.3-70b-versatile',
    custom:     'gpt-4o-mini',
  }[provider];
}

function getBaseURL(provider: AIProvider, customBaseURL?: string): string {
  if (customBaseURL) return customBaseURL.replace(/\/$/, '');
  return {
    anthropic:  '',
    openai:     'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    groq:       'https://api.groq.com/openai/v1',
    custom:     '',
  }[provider];
}

export interface AIResponse {
  message: string;
  actions: ParsedAction[];
}

function buildSystemPrompt(tasks: Task[], config: UserConfig, activeDay: 'today' | 'tomorrow'): string {
  const todayTasks = tasks.filter(t => t.day === 'today');
  const tomorrowTasks = tasks.filter(t => t.day === 'tomorrow');

  const taskList = todayTasks.length
    ? todayTasks.map(t =>
        `- [id:${t.id}] [${t.is_done ? 'done' : t.priority}]${t.is_starred ? ' ★' : ''} "${t.title}" ${t.duration_minutes}min` +
        `${t.travel_minutes ? ` (+${t.travel_minutes}min travel each way)` : ''}` +
        `${t.break_after ? ` +${t.break_after}min break after` : ''}` +
        `${t.fixed_time ? ` @ ${t.fixed_time}` : ''}`
      ).join('\n')
    : 'No tasks yet.';

  const tmrwList = tomorrowTasks.length
    ? tomorrowTasks.map(t => `- [id:${t.id}] "${t.title}" ${t.duration_minutes}min`).join('\n')
    : 'Empty.';

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const bufferMinutes = config.morning_buffer ?? 15;
  const earliestStart = nowMinutes + bufferMinutes;
  const nowStr = minutesToTime(nowMinutes);
  const earliestStartStr = minutesToTime(earliestStart);

  // Build live schedule context
  const schedule = buildSchedule(tasks, config);
  const freeMinutes = Math.max(0, schedule.availableMinutes - schedule.totalMinutes);
  const overflowList = schedule.overflow.length
    ? schedule.overflow.map(t => `- [id:${t.id}] "${t.title}" ${t.duration_minutes}min [${t.priority}]${t.is_starred ? ' ★' : ''}`).join('\n')
    : 'None.';
  const scheduleStatus = schedule.overflow.length > 0
    ? `⚠️ OVERLOADED — ${schedule.overflow.length} task(s) do not fit today`
    : `✓ Fits — ${formatDuration(freeMinutes)} free remaining`;

  return `You are UpX — a smart daily planner assistant. You help the user plan their day, create tasks, reschedule, and give advice.

## User Settings
- Wake: ${config.wake} | Sleep: ${config.sleep}
- Default break between tasks: ${config.buffer} min
- Road time for gym/workout: ${config.road_time_minutes} min each way
- Current time: ${nowStr}
- Earliest task start: ${earliestStartStr} (now + ${bufferMinutes}min buffer)
- **User is currently viewing: ${activeDay.toUpperCase()} tab** — when adding tasks without explicit day, use "${activeDay}"

## Today's Tasks
${taskList}

## Tomorrow's Tasks
${tmrwList}

## Live Schedule Status
- Status: ${scheduleStatus}
- Available today: ${formatDuration(schedule.availableMinutes)}
- Scheduled: ${formatDuration(schedule.totalMinutes)}
- Free remaining: ${formatDuration(freeMinutes)}
- Tasks in overflow (don't fit today):
${overflowList}

## CLEAR SCHEDULE INSTRUCTION
If user says "clear", "delete all", "start over", or "remove all tasks":
- Send one delete_task action per task in the ACTIVE TAB (${activeDay})
- Use the exact [id:UUID] for each task
- Example for 3 tasks: actions: [ {type:"delete_task", payload:{id:"uuid1"}}, {type:"delete_task", payload:{id:"uuid2"}}, {type:"delete_task", payload:{id:"uuid3"}} ]

Use this to make smart decisions: if overloaded, move overflow tasks to tomorrow. If free time > 30min, suggest adding productive tasks.

## DURATION PARSING — CRITICAL
Always convert duration to MINUTES (integer):
- "2 hours" or "2h" → duration_minutes: 120
- "1.5 hours" or "1.5h" or "90 min" → duration_minutes: 90
- "30 min" or "30m" or "half hour" → duration_minutes: 30
- "45 min" → duration_minutes: 45
- TIME RANGE: "from 8am to 1:10pm" → fixed_time: "08:00", duration_minutes: 310 (calculate end - start in minutes)
- TIME RANGE: "9:00 to 10:30" → fixed_time: "09:00", duration_minutes: 90
- NEVER set duration_minutes to 2 when user says "2 hours" — that would be 2 minutes!
- break_after is also in MINUTES (e.g. 10 for a 10-minute break)

## TRAVEL TIME
- For workout/gym/pool/run tasks: set travel_minutes = ${config.road_time_minutes} (from user settings)
- For office/work tasks: check known_contexts: ${JSON.stringify(config.known_contexts)}
- For home tasks: travel_minutes = 0

## SCHEDULING RULES
- If the user specifies a time range (e.g. "school from 8am to 1:10pm"), ALWAYS use that exact start time as fixed_time and calculate duration from the range — NEVER override with current time or earliestStart.
- Only apply the "never before ${earliestStartStr}" rule to tasks where the user did NOT specify a start time.
- Respect fixed_time if user specifies a time (e.g. "meeting at 3pm" → fixed_time: "15:00")
- Use fixed_time: null if no specific time mentioned

## CAPABILITIES
1. Parse tasks from natural language → create_task action
2. Build/optimize the day schedule → reschedule action  
3. Move/delete/update tasks
4. Give productivity advice

## RESPONSE FORMAT — STRICT JSON ONLY
No markdown, no text outside JSON:
{
  "message": "friendly response in same language as user",
  "actions": [
    {
      "type": "create_task",
      "payload": {
        "title": "Clean title without duration",
        "duration_minutes": 120,
        "travel_minutes": 0,
        "break_after": 10,
        "priority": "low|medium|high",
        "category": "workout|deep work|meetings|meals|creative|admin|general",
        "fixed_time": null,
        "day": "today|tomorrow",
        "recurrence": "none|daily|weekdays|weekly",
        "sort_order": 0
      }
    }
  ]
}

Other action types:
- update_task: { "id": "task-id", ...fieldsToUpdate }
- delete_task: { "id": "task-id" }
- move_task: { "id": "task-id", "day": "today|tomorrow" }
- reschedule: { "order": ["id1", "id2", ...] }

Always use empty array [] for actions if no task operations needed.

## TASK IDs — CRITICAL
Each task starts with [id:UUID]. Copy the UUID exactly — do not shorten, paraphrase, or invent IDs.
When using update_task, delete_task, move_task, or reschedule — always use the exact [id:UUID] value.

## OVERLOAD HANDLING
If user says they are overwhelmed, overloaded, or have too many tasks:
- DO NOT use reschedule — it only reorders, does not free up time.
- Use move_task to push low-priority non-starred tasks to tomorrow.
- Keep ★ starred and high-priority tasks for today.
- Example:
  { "type": "move_task", "payload": { "id": "<exact-uuid>", "day": "tomorrow" } }`;
}

function assertASCII(value: string, label: string): void {
  // HTTP headers only allow ISO-8859-1. API keys must be ASCII.
  if (/[^\x00-\x7F]/.test(value)) {
    throw new Error(
      `Your ${label} contains non-ASCII characters. Please check your settings in Profile.`
    );
  }
}

// Call via server-side proxy (no API key on client) or directly if user supplied key
async function callViaProxy(
  provider: AIProvider,
  model: string,
  system: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, system, messages, max_tokens: 2000 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Proxy ${res.status}: ${(err as { error?: string })?.error || res.statusText}`);
  }
  const data = await res.json();
  // Normalize response shape from both Anthropic and OpenAI formats
  return data.content?.[0]?.text || data.choices?.[0]?.message?.content || '{}';
}

async function callAnthropic(
  userMessage: string,
  history: ChatMessage[],
  systemPrompt: string,
  cfg: AIConfig
): Promise<string> {
  const messages = [
    ...history.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  // If user provided their own key — call directly (dev/custom setup)
  if (cfg.apiKey) {
    assertASCII(cfg.apiKey, 'Anthropic API key');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: cfg.model || defaultModel('anthropic'),
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Anthropic ${res.status}: ${(err as { error?: { message?: string } })?.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text || '{}';
  }

  // No key — use server proxy
  return callViaProxy('anthropic', cfg.model || defaultModel('anthropic'), systemPrompt, messages);
}

async function callOpenAICompat(
  userMessage: string,
  history: ChatMessage[],
  systemPrompt: string,
  cfg: AIConfig
): Promise<string> {
  const provider = cfg.provider;
  const model = cfg.model || defaultModel(provider);
  const msgs = [
    ...history.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  // No key — use server proxy (only for known providers)
  if (!cfg.apiKey && ['openai', 'openrouter', 'groq'].includes(provider)) {
    return callViaProxy(provider, model, systemPrompt, msgs);
  }

  const baseURL = getBaseURL(provider, cfg.baseURL);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...msgs,
  ];

  assertASCII(cfg.apiKey, `${provider} API key`);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cfg.apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://upx-app.vercel.app';
    headers['X-Title'] = 'UpX Planner';
  }

  const body: Record<string, unknown> = { model, max_tokens: 2000, messages };
  if (provider !== 'custom') body.response_format = { type: 'json_object' };

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { error?: { message?: string } })?.error?.message || res.statusText;
    if (res.status === 404) {
      throw new Error(`${provider} 404: Model "${model}" not found. Go to Profile → AI Settings and update your model.`);
    }
    throw new Error(`${provider} ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '{}';
}

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  tasks: Task[],
  config: UserConfig,
  apiKey: string,
  activeDay: 'today' | 'tomorrow',
  customBaseURL?: string,
  customModel?: string
): Promise<AIResponse> {
  const effectiveKey = apiKey;
  const provider = detectProvider(effectiveKey, customBaseURL);
  const cfg: AIConfig = { apiKey: effectiveKey, provider, baseURL: customBaseURL, model: customModel };
  const systemPrompt = buildSystemPrompt(tasks, config, activeDay);

  const rawText = provider === 'anthropic'
    ? await callAnthropic(userMessage, history, systemPrompt, cfg)
    : await callOpenAICompat(userMessage, history, systemPrompt, cfg);

  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { message: parsed.message || 'Done!', actions: parsed.actions || [] };
  } catch {
    return { message: rawText, actions: [] };
  }
}