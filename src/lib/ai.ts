import type { Task, UserConfig, ChatMessage, ParsedAction } from '../types';
import { minutesToTime } from './scheduler';

export type AIProvider = 'anthropic' | 'openai' | 'openrouter' | 'groq' | 'custom';

export interface AIConfig {
  apiKey: string;
  provider: AIProvider;
  baseURL?: string;   // for custom / openrouter
  model?: string;     // override model
}

// Auto-detect provider from key prefix
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

// Default model per provider
function defaultModel(provider: AIProvider): string {
  return {
    anthropic:  'claude-sonnet-4-20250514',
    openai:     'gpt-4o-mini',
    openrouter: 'openai/gpt-4o-mini',
    groq:       'llama-3.3-70b-versatile',
    custom:     'gpt-4o-mini',
  }[provider];
}

// Base URL per provider
function getBaseURL(provider: AIProvider, customBaseURL?: string): string {
  if (customBaseURL) return customBaseURL.replace(/\/$/, '');
  return {
    anthropic:  '', // handled separately
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
        `- [${t.is_done ? 'done' : t.priority}] "${t.title}" ${t.duration_minutes}min${t.travel_minutes ? ` (+${t.travel_minutes}min travel each way)` : ''}${t.break_after ? ` +${t.break_after}min break` : ''}${t.fixed_time ? ` @ ${t.fixed_time}` : ''}${t.is_starred ? ' ★' : ''} (id:${t.id})`
      ).join('\n')
    : 'No tasks yet.';

  const tmrwList = tomorrowTasks.length
    ? tomorrowTasks.map(t => `- "${t.title}" ${t.duration_minutes}min`).join('\n')
    : 'Empty.';

  return `You are UpX — a smart daily planner assistant. You help the user plan their day efficiently, create tasks, reschedule, and give advice.

## User Settings
- Wake: ${config.wake}
- Sleep: ${config.sleep}
- Default break between tasks: ${config.buffer} min
- Gym/workout travel: ${config.road_time_minutes} min each way
- Known contexts: ${JSON.stringify(config.known_contexts)}

## Today's Tasks
${taskList}

## Tomorrow's Tasks
${tmrwList}

## Your capabilities
1. Parse tasks from natural language — "edit video 60min" → create a task
2. Build the day schedule — arrange tasks optimally considering travel, breaks, energy
3. Advise and reschedule — help when user is overloaded, suggest what to move
4. Answer questions — general productivity advice

## Rules
- Always respond in the SAME language the user writes in (Russian or English)
- Be concise and friendly, not verbose
- For workout/gym tasks: automatically add travel_minutes = gym_travel_minutes from config
- Current time: ${minutesToTime(new Date().getHours() * 60 + new Date().getMinutes())}

## IMPORTANT: Response format
You MUST always respond with ONLY valid JSON. No markdown, no text outside JSON:
{
  "message": "your friendly response to the user",
  "actions": [
    {
      "type": "create_task",
      "payload": {
        "title": "string",
        "duration_minutes": number,
        "travel_minutes": number,
        "break_after": number,
        "priority": "low|medium|high",
        "category": "string",
        "fixed_time": null,
        "day": "today|tomorrow"
      }
    }
  ]
}
Other action types: update_task {id, ...fields}, delete_task {id}, move_task {id, day}, reschedule {order: [id1, id2, ...]}.
If no actions needed, use empty array [].`;
}

// ── ANTHROPIC ────────────────────────────────────────────────────────────────
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
    throw new Error(`Anthropic ${res.status}: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '{}';
}

// ── OPENAI-COMPATIBLE (OpenAI, OpenRouter, Groq, Ollama, custom) ─────────────
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

  // OpenRouter requires these extra headers
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://upx-app.vercel.app';
    headers['X-Title'] = 'UpX Planner';
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: 1000,
    messages,
  };

  // JSON mode — supported by OpenAI, OpenRouter, Groq
  if (provider !== 'custom') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${provider} ${res.status}: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '{}';
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────
export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  tasks: Task[],
  config: UserConfig,
  apiKey: string,
  customBaseURL?: string,
  customModel?: string
): Promise<AIResponse> {
  const provider = detectProvider(apiKey, customBaseURL);
  const cfg: AIConfig = { apiKey, provider, baseURL: customBaseURL, model: customModel };
  const systemPrompt = buildSystemPrompt(tasks, config);

  let rawText: string;

  if (provider === 'anthropic') {
    rawText = await callAnthropic(userMessage, history, systemPrompt, cfg);
  } else {
    rawText = await callOpenAICompat(userMessage, history, systemPrompt, cfg);
  }

  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      message: parsed.message || 'Done!',
      actions: parsed.actions || [],
    };
  } catch {
    return { message: rawText, actions: [] };
  }
}
