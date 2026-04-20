import type { Task, UserConfig, ChatMessage, ParsedAction } from '../types';
import { minutesToTime } from './scheduler';

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

function buildSystemPrompt(tasks: Task[], config: UserConfig): string {
  const todayTasks = tasks.filter(t => t.day === 'today');
  const tomorrowTasks = tasks.filter(t => t.day === 'tomorrow');

  const taskList = todayTasks.length
    ? todayTasks.map(t =>
        `- [${t.is_done ? 'done' : t.priority}] "${t.title}" ${t.duration_minutes}min` +
        `${t.travel_minutes ? ` (+${t.travel_minutes}min travel each way)` : ''}` +
        `${t.break_after ? ` +${t.break_after}min break after` : ''}` +
        `${t.fixed_time ? ` @ ${t.fixed_time}` : ''}` +
        `${t.is_starred ? ' ★' : ''} (id:${t.id})`
      ).join('\n')
    : 'No tasks yet.';

  const tmrwList = tomorrowTasks.length
    ? tomorrowTasks.map(t => `- "${t.title}" ${t.duration_minutes}min (id:${t.id})`).join('\n')
    : 'Empty.';

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const bufferMinutes = config.morning_buffer ?? 15;
  const earliestStart = nowMinutes + bufferMinutes;
  const nowStr = minutesToTime(nowMinutes);
  const earliestStartStr = minutesToTime(earliestStart);

  return `You are UpX — a smart daily planner assistant. You help the user plan their day, create tasks, reschedule, and give advice.

## User Settings
- Wake: ${config.wake} | Sleep: ${config.sleep}
- Default break between tasks: ${config.buffer} min
- Road time for gym/workout: ${config.road_time_minutes} min each way
- Current time: ${nowStr}
- Earliest task start: ${earliestStartStr} (now + ${bufferMinutes}min buffer)

## Today's Tasks
${taskList}

## Tomorrow's Tasks
${tmrwList}

## DURATION PARSING — CRITICAL
Always convert duration to MINUTES (integer):
- "2 hours" or "2h" → duration_minutes: 120
- "1.5 hours" or "1.5h" or "90 min" → duration_minutes: 90
- "30 min" or "30m" or "half hour" → duration_minutes: 30
- "45 min" → duration_minutes: 45
- NEVER set duration_minutes to 2 when user says "2 hours" — that would be 2 minutes!
- break_after is also in MINUTES (e.g. 10 for a 10-minute break)

## TRAVEL TIME
- For workout/gym/pool/run tasks: set travel_minutes = ${config.road_time_minutes} (from user settings)
- For office/work tasks: check known_contexts: ${JSON.stringify(config.known_contexts)}
- For home tasks: travel_minutes = 0

## SCHEDULING RULES
- Never schedule a task before ${earliestStartStr}
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

Always use empty array [] for actions if no task operations needed.`;
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
      max_tokens: 1000,
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

async function callOpenAICompat(
  userMessage: string,
  history: ChatMessage[],
  systemPrompt: string,
  cfg: AIConfig
): Promise<string> {
  const provider = cfg.provider;
  const baseURL = getBaseURL(provider, cfg.baseURL);
  const model = cfg.model || defaultModel(provider);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cfg.apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://upx-app.vercel.app';
    headers['X-Title'] = 'UpX Planner';
  }

  const body: Record<string, unknown> = { model, max_tokens: 1000, messages };
  if (provider !== 'custom') body.response_format = { type: 'json_object' };

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${provider} ${res.status}: ${(err as { error?: { message?: string } })?.error?.message || res.statusText}`);
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
  customBaseURL?: string,
  customModel?: string
): Promise<AIResponse> {
  const effectiveKey = apiKey;
  const provider = detectProvider(effectiveKey, customBaseURL);
  const cfg: AIConfig = { apiKey: effectiveKey, provider, baseURL: customBaseURL, model: customModel };
  const systemPrompt = buildSystemPrompt(tasks, config);

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