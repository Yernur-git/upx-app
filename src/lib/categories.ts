// Auto-detect category from task title
const CATEGORY_RULES: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['workout', 'gym', 'run', 'running', 'swim', 'swimming', 'yoga', 'training', 'exercise', 'lifting', 'crossfit', 'cardio', 'cycling', 'bike', 'football', 'basketball', 'tennis', 'sport', 'тренировка', 'зал', 'бег'], category: 'workout' },
  { keywords: ['deep work', 'code', 'coding', 'programming', 'dev', 'develop', 'study', 'studying', 'learn', 'learning', 'read', 'reading', 'research', 'write', 'writing', 'focus', 'работа', 'учёба', 'учеба', 'чтение'], category: 'deep work' },
  { keywords: ['meeting', 'call', 'standup', 'sync', 'interview', 'presentation', 'встреча', 'звонок'], category: 'meetings' },
  { keywords: ['lunch', 'dinner', 'breakfast', 'eat', 'food', 'meal', 'coffee', 'обед', 'ужин', 'завтрак', 'еда'], category: 'meals' },
  { keywords: ['walk', 'walking', 'прогулка', 'гулять'], category: 'walks' },
  { keywords: ['edit', 'video', 'design', 'create', 'creative', 'record', 'shoot', 'photo', 'монтаж', 'дизайн'], category: 'creative' },
  { keywords: ['admin', 'email', 'emails', 'inbox', 'paperwork', 'errands', 'почта', 'задачи'], category: 'admin' },
];

export function detectCategory(title: string): string {
  const lower = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.category;
    }
  }
  return 'general';
}

export function getAllCategories(goals: Array<{ category: string }>): string[] {
  const fromRules = CATEGORY_RULES.map(r => r.category);
  const fromGoals = goals.map(g => g.category);
  return [...new Set([...fromGoals, ...fromRules, 'general'])];
}