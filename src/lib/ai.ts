import type { Task, UserConfig, ChatMessage, ParsedAction } from '../types';
import { minutesToTime } from './scheduler';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

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
- Gym/workout travel: ${config.gym_travel_minutes} min each way
- Known contexts: ${JSON.stringify(config.known_contexts)}

## Today's Tasks
${taskList}

## Tomorrow's Tasks
${tmrwList}

## Your capabilities
1. **Parse tasks from natural language** — user writes "edit video 60min" → create a task
2. **Build the day schedule** — arrange tasks optimally considering travel, breaks, energy
3. **Advise and reschedule** — help when user is overloaded, suggest what to move
4. **Answer questions** — general productivity advice

## Rules
- Always respond in the SAME language the user writes in (Russian or English)
- Be concise and friendly, not verbose
- When creating tasks, extract: title, duration, travel_time (if location-based like gym/office), priority, break_after
- For workout/gym tasks: automatically add travel_minutes = gym_travel_minutes from config
- When you perform actions, include them in your JSON actions array
- Current time: ${minutesToTime(new Date().getHours() * 60 + new Date().getMinutes())}

## Response format
Always respond with valid JSON:
{
  "message": "your friendly response to the user",
  "actions": [
    // optional array of actions to perform
    {
      "type": "create_task",
      "payload": {
        "title": "string",
        "duration_minutes": number,
        "travel_minutes": number,
        "break_after": number,
        "priority": "low|medium|high",
        "category": "string",
        "fixed_time": "HH:MM or null",
        "day": "today|tomorrow"
      }
    },
    {
      "type": "update_task",
      "payload": { "id": "task-id", ...fieldsToUpdate }
    },
    {
      "type": "delete_task", 
      "payload": { "id": "task-id" }
    },
    {
      "type": "move_task",
      "payload": { "id": "task-id", "day": "today|tomorrow" }
    },
    {
      "type": "reschedule",
      "payload": { "order": ["task-id-1", "task-id-2", ...] }
    }
  ]
}`;
}

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  tasks: Task[],
  config: UserConfig,
  apiKey: string
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(tasks, config);

  const messages = [
    ...history.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text || '{}';

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

export function parseNaturalTask(text: string): Partial<Task> | null {
  // Quick client-side parse as fallback
  const durationMatch = text.match(/(\d+)\s*(?:min|м|мин|минут|hour|h|час)/i);
  if (!durationMatch) return null;

  const duration = durationMatch[1];
  const title = text.replace(durationMatch[0], '').trim().replace(/\s+/g, ' ');

  return {
    title: title || text,
    duration_minutes: parseInt(duration),
    priority: 'medium',
    break_after: 0,
    travel_minutes: 0,
    category: 'general',
    is_starred: false,
    is_done: false,
    day: 'today',
  };
}
