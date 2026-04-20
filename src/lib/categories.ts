import type { CategoryGoal } from '../types';

// Built-in keyword rules (fallback)
const BUILTIN_RULES: Array<{ keywords: string[]; category: string }> = [
  {
    keywords: ['workout', 'gym', 'run', 'running', 'swim', 'swimming', 'yoga',
      'training', 'exercise', 'lifting', 'crossfit', 'cardio', 'cycling', 'bike',
      'football', 'basketball', 'tennis', 'sport', 'fitness', 'тренировка', 'зал',
      'бег', 'упражнения', 'качалка', 'физра', 'спорт', 'плавание'],
    category: 'workout',
  },
  {
    keywords: ['deep work', 'code', 'coding', 'programming', 'dev', 'develop',
      'study', 'studying', 'learn', 'learning', 'read', 'reading', 'research',
      'write', 'writing', 'focus', 'работа', 'учёба', 'учеба', 'чтение', 'программирование'],
    category: 'deep work',
  },
  {
    keywords: ['meeting', 'call', 'standup', 'sync', 'interview', 'presentation',
      'встреча', 'звонок', 'совещание'],
    category: 'meetings',
  },
  {
    keywords: ['lunch', 'dinner', 'breakfast', 'eat', 'food', 'meal', 'coffee',
      'обед', 'ужин', 'завтрак', 'еда', 'покушать', 'поесть'],
    category: 'meals',
  },
  {
    keywords: ['walk', 'walking', 'прогулка', 'гулять', 'прогуляться'],
    category: 'walks',
  },
  {
    keywords: ['edit', 'editing', 'video', 'design', 'create', 'creative', 'record',
      'shoot', 'photo', 'монтаж', 'дизайн', 'видео', 'снимать', 'фото'],
    category: 'creative',
  },
  {
    keywords: ['admin', 'email', 'emails', 'inbox', 'paperwork', 'errands',
      'почта', 'административн'],
    category: 'admin',
  },
];

/**
 * Match task title against a category name using word-level matching.
 * "edit video" goal matches "video editing 60min", "Edit my Vlog", "видео монтаж" etc.
 */
function matchesGoal(title: string, goalCategory: string): boolean {
  const titleLower = title.toLowerCase();
  const goalWords = goalCategory.toLowerCase()
    .split(/[\s\-_\/]+/)
    .filter(w => w.length >= 3); // skip short words like "a", "an", "in"

  // If ANY word from the goal name appears in the title → match
  return goalWords.some(word => titleLower.includes(word));
}

/**
 * Detect category for a task title.
 * Priority: user's custom goals (by word match) → built-in rules → 'general'
 */
export function detectCategory(title: string, goals: CategoryGoal[] = []): string {
  if (!title.trim()) return 'general';

  // 1. Try to match against user's custom goal categories first
  for (const goal of goals) {
    if (matchesGoal(title, goal.category)) {
      return goal.category;
    }
  }

  // 2. Fall back to built-in keyword rules
  const lower = title.toLowerCase();
  for (const rule of BUILTIN_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.category;
    }
  }

  return 'general';
}

/**
 * Check if a task title/category matches a specific goal category.
 * Used in StatsPanel to count minutes.
 */
export function taskMatchesGoal(
  taskTitle: string,
  taskCategory: string,
  goalCategory: string
): boolean {
  const goalLower = goalCategory.toLowerCase();
  const catLower = taskCategory.toLowerCase();

  // Exact category match
  if (catLower === goalLower) return true;

  // Word-level match on title
  if (matchesGoal(taskTitle, goalCategory)) return true;

  // Built-in rule match: if task matches a built-in category that equals goal
  const lower = taskTitle.toLowerCase();
  for (const rule of BUILTIN_RULES) {
    if (rule.category === goalLower && rule.keywords.some(kw => lower.includes(kw))) {
      return true;
    }
  }

  return false;
}

export function getAllCategories(goals: Array<{ category: string }>): string[] {
  const fromRules = BUILTIN_RULES.map(r => r.category);
  const fromGoals = goals.map(g => g.category);
  return [...new Set([...fromGoals, ...fromRules, 'general'])];
}