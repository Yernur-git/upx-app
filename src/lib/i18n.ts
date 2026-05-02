import { useStore } from '../store';

export type Lang = 'en' | 'ru';

const DICT = {
  en: {
    // Greetings
    'greeting.night':     'Good night',
    'greeting.morning':   'Good morning',
    'greeting.afternoon': 'Good afternoon',
    'greeting.evening':   'Good evening',

    // Nav
    'nav.profile': 'Profile',
    'nav.plan':    'Plan',
    'nav.stats':   'Stats',
    'nav.schedule': 'Schedule',

    // Days
    'day.today':    'Today',
    'day.tomorrow': 'Tomorrow',
    'day.mon': 'Mon', 'day.tue': 'Tue', 'day.wed': 'Wed',
    'day.thu': 'Thu', 'day.fri': 'Fri', 'day.sat': 'Sat', 'day.sun': 'Sun',
    'day.short.mon': 'Mo', 'day.short.tue': 'Tu', 'day.short.wed': 'We',
    'day.short.thu': 'Th', 'day.short.fri': 'Fr', 'day.short.sat': 'Sa', 'day.short.sun': 'Su',

    // Tasks
    'task.empty.today.title':    'No tasks today',
    'task.empty.today.desc':     'Add a task below or tell the AI what you need to do today.',
    'task.empty.tomorrow.title': 'Tomorrow is clear',
    'task.empty.tomorrow.desc':  'Plan ahead — add tasks for tomorrow or ask the AI to help.',
    'task.add':         'Add task',
    'task.moreOptions': 'More options',
    'task.adding':      'Adding…',
    'task.add.btn':     'Add',
    'task.cancel':      'Cancel',
    'task.save':        'Save',
    'task.delete':      'Delete',
    'task.deleteConfirm': 'Delete this task?',
    'task.title.placeholder': 'Task title…',
    'task.title':       'Edit task',
    'task.notes':       'Notes',
    'task.notes.placeholder': 'Notes (optional)',
    'task.duration':    'Duration (min)',
    'task.road':        'Road (min)',
    'task.priority':    'Priority',
    'task.priority.high':   'High',
    'task.priority.medium': 'Medium',
    'task.priority.low':    'Low',
    'task.break':       'Break after task',
    'task.break.none':  'None',
    'task.break.custom': 'custom',
    'task.startTime':   'Start time (optional)',
    'task.fixedTime':   'Fixed time (optional)',
    'task.category':    'Category',
    'task.category.auto': 'auto',
    'task.category.other': 'other (custom)',
    'task.category.customPlaceholder': 'Type custom category…',
    'task.repeat':      'Repeat',
    'task.repeat.none':     'No repeat',
    'task.repeat.daily':    'Every day',
    'task.repeat.weekdays': 'Weekdays',
    'task.repeat.weekly':   'Weekly',
    'task.repeat.custom':   'Custom…',
    'task.repeatOn':    'Repeat on',
    'task.done':        'Done',

    // Stats
    'stats.today':         'Today',
    'stats.thisWeek':      'This week',
    'stats.weeklyGoals':   'Weekly goals',
    'stats.streak':        'Streak',
    'stats.aiFeedback':    'AI feedback',
    'stats.askAI':         'Ask AI to review my week',
    'stats.askingAI':      'Asking AI…',
    'stats.done':          'Done',
    'stats.hoursDone':     'Hours done',
    'stats.remaining':     'Remaining',
    'stats.tasksCompleted':'{done} of {total} tasks completed',
    'stats.doneThisWeek':  'done this week',
    'stats.ofPlanned':     'of planned',
    'stats.remainingWeek': '{rem} remaining this week',
    'stats.goalReached':   '✓ Goal reached!',
    'stats.streakDays':    '{n} days',
    'stats.streakDesc':    'consecutive days at 80%+ completion',
    'stats.noStreak':      'No streak yet — finish 80% of today to start one.',
    'stats.dayDetail':     'Day detail',
    'stats.completedTasks':'Completed',
    'stats.missedTasks':   'Missed',
    'stats.noData':        'No data for this day.',
    'stats.close':         'Close',
    'stats.notEnoughData': 'Not enough data yet — use the app for a few days first.',
    'stats.aiError':       'AI request failed. Check your provider settings.',

    // Profile
    'profile.account':         'Account',
    'profile.localAccount':    'Local account',
    'profile.localWarn':       '⚠️ No sync — device only',
    'profile.synced':          '✓ Synced across devices',
    'profile.signOut':         'Sign out',
    'profile.signOutConfirm':  'Sign out of your account?',
    'profile.schedule':        'Schedule',
    'profile.wake':            'Wake up',
    'profile.sleep':           'Sleep',
    'profile.morningBuffer':   'Morning buffer',
    'profile.taskBreak':       'Break between tasks',
    'profile.roadTime':        'Road time (each way)',
    'profile.min':             'min',
    'profile.weeklyGoals':     'Weekly goals',
    'profile.noGoals':         'No goals yet',
    'profile.hPerWeek':        'h / week',
    'profile.removeGoal':      'Remove "{cat}" goal?',
    'profile.goalCategory':    'Category name (e.g. workout, deep work)',
    'profile.hoursShort':      'h',
    'profile.goalHelp':        'Match category names with your tasks (case-insensitive).',
    'profile.notifications':    'Notifications',
    'profile.taskReminders':    'Task reminders',
    'profile.notifEnabled':     '10 min before + at start time',
    'profile.notifDisabled':    'Get notified before tasks start',
    'profile.notifOn':          '✓ Enabled',
    'profile.enable':           'Enable',
    'profile.test':             'Test',
    'profile.pushTitle':        'Push notifications',
    'profile.pushOn':           'Active — works even when app is closed',
    'profile.pushOff':          'Off — get reminders even when app is closed',
    'profile.pushUnsupported':  'Not supported in this browser',
    'profile.pushEnable':       'Enable',
    'profile.pushDisable':      'Turn off',
    'profile.pushEnabled':      'Push notifications enabled!',
    'profile.pushDenied':       'Permission denied. Allow notifications in browser settings.',
    'profile.pushMorningHint':  'You\'ll get a morning briefing every day at 7:00 AM with your task count.',
    'profile.aiProvider':      'AI Provider',
    'profile.aiNotConfigured': 'Not configured — tap to set up',
    'profile.apiKey':          'API Key',
    'profile.baseURL':         'Base URL',
    'profile.baseURLHint':     '(leave empty for auto)',
    'profile.model':           'Model',
    'profile.appearance':      'Appearance',
    'profile.themeLight':      'Light',
    'profile.themeDark':       'Dark',
    'profile.language':        'Language',
    'profile.danger':          'Danger zone',
    'profile.deleteAll':       'Delete all tasks',
    'profile.deleteAllConfirm':'Delete ALL tasks? This cannot be undone.',

    // Chat
    'chat.title':       'UpX AI',
    'chat.subtitle':    'Plan smarter, not harder',
    'chat.hi':          "Hi! I'm your day planner.",
    'chat.hiDesc':      "Tell me what you need to do today and I'll build your schedule.",
    'chat.placeholder': 'edit video 60min or ask anything…',
    'chat.actionsApplied': '✓ {n} action{s} applied',
    'chat.aiChanged':   'AI made changes to your tasks',
    'chat.undo':        'Undo',
    'chat.undone':      '↩️ Changes undone.',
    'chat.error':       'Something went wrong: {err}',

    // Timeline
    'timeline.title':   "Today's Schedule",
    'timeline.overflow':"⚠️ {n} task{s} won't fit today",
    'timeline.break':   'Break',
    'timeline.freeTime':'Free time',

    // Common
    'common.confirm':   'Confirm',
    'common.cancel':    'Cancel',

    // Onboarding
    'onb.wake.title':       'When do you wake up?',
    'onb.wake.subtitle':    "We'll build your schedule around your day.",
    'onb.task.title':       "What's your first task?",
    'onb.task.subtitle':    'Add one thing you want to get done today.',
    'onb.goal.title':       'Set a weekly goal',
    'onb.goal.subtitle':    'Track progress on things that matter to you.',
    'onb.wakeUp':           'Wake up',
    'onb.bedtime':          'Bedtime',
    'onb.taskPlaceholder':  'e.g. Morning workout, Deep work session…',
    'onb.taskDuration':     'Duration (min)',
    'onb.skip':             'Skip for now',
    'onb.goalPlaceholder':  'Or type your own category…',
    'onb.goalHours':        'Weekly goal (hours)',
    'onb.continue':         'Continue',
    'onb.lets':             "Let's go",
  },
  ru: {
    // Greetings
    'greeting.night':     'Доброй ночи',
    'greeting.morning':   'Доброе утро',
    'greeting.afternoon': 'Добрый день',
    'greeting.evening':   'Добрый вечер',

    // Nav
    'nav.profile': 'Профиль',
    'nav.plan':    'План',
    'nav.stats':   'Статы',
    'nav.schedule': 'Расписание',

    // Days
    'day.today':    'Сегодня',
    'day.tomorrow': 'Завтра',
    'day.mon': 'Пн', 'day.tue': 'Вт', 'day.wed': 'Ср',
    'day.thu': 'Чт', 'day.fri': 'Пт', 'day.sat': 'Сб', 'day.sun': 'Вс',
    'day.short.mon': 'Пн', 'day.short.tue': 'Вт', 'day.short.wed': 'Ср',
    'day.short.thu': 'Чт', 'day.short.fri': 'Пт', 'day.short.sat': 'Сб', 'day.short.sun': 'Вс',

    // Tasks
    'task.empty.today.title':    'Нет задач на сегодня',
    'task.empty.today.desc':     'Добавьте задачу ниже или попросите ИИ помочь спланировать день.',
    'task.empty.tomorrow.title': 'Завтра пусто',
    'task.empty.tomorrow.desc':  'Планируйте заранее — добавьте задачи на завтра или попросите ИИ.',
    'task.add':         'Добавить задачу',
    'task.moreOptions': 'Подробнее',
    'task.adding':      'Добавление…',
    'task.add.btn':     'Добавить',
    'task.cancel':      'Отмена',
    'task.save':        'Сохранить',
    'task.delete':      'Удалить',
    'task.deleteConfirm': 'Удалить эту задачу?',
    'task.title.placeholder': 'Название задачи…',
    'task.title':       'Редактировать задачу',
    'task.notes':       'Заметки',
    'task.notes.placeholder': 'Заметки (необязательно)',
    'task.duration':    'Длительность (мин)',
    'task.road':        'Дорога (мин)',
    'task.priority':    'Приоритет',
    'task.priority.high':   'Высокий',
    'task.priority.medium': 'Средний',
    'task.priority.low':    'Низкий',
    'task.break':       'Перерыв после задачи',
    'task.break.none':  'Нет',
    'task.break.custom': 'свой',
    'task.startTime':   'Время начала (необязательно)',
    'task.fixedTime':   'Фикс. время (необязательно)',
    'task.category':    'Категория',
    'task.category.auto': 'авто',
    'task.category.other': 'другая (своя)',
    'task.category.customPlaceholder': 'Введите свою категорию…',
    'task.repeat':      'Повтор',
    'task.repeat.none':     'Без повтора',
    'task.repeat.daily':    'Каждый день',
    'task.repeat.weekdays': 'По будням',
    'task.repeat.weekly':   'Раз в неделю',
    'task.repeat.custom':   'Свой график…',
    'task.repeatOn':    'Повторять по',
    'task.done':        'Сделано',

    // Stats
    'stats.today':         'Сегодня',
    'stats.thisWeek':      'Эта неделя',
    'stats.weeklyGoals':   'Недельные цели',
    'stats.streak':        'Стрик',
    'stats.aiFeedback':    'Оценка ИИ',
    'stats.askAI':         'Попросить ИИ оценить неделю',
    'stats.askingAI':      'ИИ думает…',
    'stats.done':          'Сделано',
    'stats.hoursDone':     'Часов сделано',
    'stats.remaining':     'Осталось',
    'stats.tasksCompleted':'{done} из {total} задач выполнено',
    'stats.doneThisWeek':  'сделано за неделю',
    'stats.ofPlanned':     'от плана',
    'stats.remainingWeek': 'осталось {rem} на неделю',
    'stats.goalReached':   '✓ Цель достигнута!',
    'stats.streakDays':    '{n} дн.',
    'stats.streakDesc':    'дней подряд с выполнением 80%+',
    'stats.noStreak':      'Стрика пока нет — закройте 80% задач сегодня, чтобы начать.',
    'stats.dayDetail':     'Детали дня',
    'stats.completedTasks':'Выполнено',
    'stats.missedTasks':   'Не сделано',
    'stats.noData':        'Нет данных за этот день.',
    'stats.close':         'Закрыть',
    'stats.notEnoughData': 'Мало данных — попользуйтесь приложением несколько дней.',
    'stats.aiError':       'Запрос к ИИ не прошёл. Проверьте настройки провайдера.',

    // Profile
    'profile.account':         'Аккаунт',
    'profile.localAccount':    'Локальный аккаунт',
    'profile.localWarn':       '⚠️ Без синхронизации — только это устройство',
    'profile.synced':          '✓ Синхронизация между устройствами',
    'profile.signOut':         'Выйти',
    'profile.signOutConfirm':  'Выйти из аккаунта?',
    'profile.schedule':        'Расписание',
    'profile.wake':            'Подъём',
    'profile.sleep':           'Отбой',
    'profile.morningBuffer':   'Утренний буфер',
    'profile.taskBreak':       'Перерыв между задачами',
    'profile.roadTime':        'Дорога (в одну сторону)',
    'profile.min':             'мин',
    'profile.weeklyGoals':     'Недельные цели',
    'profile.noGoals':         'Целей пока нет',
    'profile.hPerWeek':        'ч / неделю',
    'profile.removeGoal':      'Удалить цель «{cat}»?',
    'profile.goalCategory':    'Название категории (напр. workout, deep work)',
    'profile.hoursShort':      'ч',
    'profile.goalHelp':        'Сопоставляется с задачами по названию категории (без учёта регистра).',
    'profile.notifications':    'Уведомления',
    'profile.taskReminders':    'Напоминания о задачах',
    'profile.notifEnabled':     'За 10 мин до + в момент старта',
    'profile.notifDisabled':    'Получайте уведомления перед задачами',
    'profile.notifOn':          '✓ Включены',
    'profile.enable':           'Включить',
    'profile.test':             'Тест',
    'profile.pushTitle':        'Push-уведомления',
    'profile.pushOn':           'Активны — работают даже когда приложение закрыто',
    'profile.pushOff':          'Выкл — напоминания даже когда приложение закрыто',
    'profile.pushUnsupported':  'Не поддерживается в этом браузере',
    'profile.pushEnable':       'Включить',
    'profile.pushDisable':      'Отключить',
    'profile.pushEnabled':      'Push-уведомления включены!',
    'profile.pushDenied':       'Разрешение отклонено. Разрешите уведомления в настройках браузера.',
    'profile.pushMorningHint':  'Каждое утро в 7:00 вы получите сводку с количеством задач на день.',
    'profile.aiProvider':      'ИИ-провайдер',
    'profile.aiNotConfigured': 'Не настроен — нажмите для настройки',
    'profile.apiKey':          'API-ключ',
    'profile.baseURL':         'Base URL',
    'profile.baseURLHint':     '(пусто = авто)',
    'profile.model':           'Модель',
    'profile.appearance':      'Внешний вид',
    'profile.themeLight':      'Светлая',
    'profile.themeDark':       'Тёмная',
    'profile.language':        'Язык',
    'profile.danger':          'Опасная зона',
    'profile.deleteAll':       'Удалить все задачи',
    'profile.deleteAllConfirm':'Удалить ВСЕ задачи? Это нельзя отменить.',

    // Chat
    'chat.title':       'UpX AI',
    'chat.subtitle':    'Планируй умнее, а не больше',
    'chat.hi':          'Привет! Я твой планировщик.',
    'chat.hiDesc':      'Расскажи, что нужно сделать сегодня — построю расписание.',
    'chat.placeholder': 'монтаж 60мин или спроси что угодно…',
    'chat.actionsApplied': '✓ Применено: {n}',
    'chat.aiChanged':   'ИИ изменил твои задачи',
    'chat.undo':        'Откатить',
    'chat.undone':      '↩️ Изменения отменены.',
    'chat.error':       'Что-то пошло не так: {err}',

    // Timeline
    'timeline.title':   'Расписание на сегодня',
    'timeline.overflow':"⚠️ {n} задач не помещается сегодня",
    'timeline.break':   '☕ Перерыв',
    'timeline.freeTime':'Свободное время',

    // Common
    'common.confirm':   'Подтвердить',
    'common.cancel':    'Отмена',

    // Onboarding
    'onb.wake.title':       'Когда ты просыпаешься?',
    'onb.wake.subtitle':    'Мы построим расписание под твой день.',
    'onb.task.title':       'Какая твоя первая задача?',
    'onb.task.subtitle':    'Добавь одну вещь, которую хочешь сделать сегодня.',
    'onb.goal.title':       'Поставь недельную цель',
    'onb.goal.subtitle':    'Отслеживай прогресс в важных для тебя вещах.',
    'onb.wakeUp':           'Подъём',
    'onb.bedtime':          'Отбой',
    'onb.taskPlaceholder':  'напр. Утренняя тренировка, глубокая работа…',
    'onb.taskDuration':     'Длительность (мин)',
    'onb.skip':             'Пропустить',
    'onb.goalPlaceholder':  'Или введи свою категорию…',
    'onb.goalHours':        'Недельная цель (часов)',
    'onb.continue':         'Дальше',
    'onb.lets':             'Поехали',
  },
} satisfies Record<Lang, Record<string, string>>;

type Key = keyof typeof DICT.en;

export function t(key: Key, params?: Record<string, string | number>): string {
  const lang = (useStore.getState().config.language ?? 'en') as Lang;
  const dict = DICT[lang] ?? DICT.en;
  let str: string = (dict as Record<string, string>)[key] ?? (DICT.en as Record<string, string>)[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, String(v));
      // Simple plural support: {s} → 's' if n != 1, else ''
      if (k === 'n' || k === 'count') {
        str = str.replace('{s}', Number(v) === 1 ? '' : 's');
      }
    }
  }
  return str;
}

/** React hook — re-renders on language change. */
export function useT(): typeof t {
  // Subscribe to language so components re-render when it changes
  useStore(s => s.config.language);
  return t;
}

/**
 * Russian plural form selector.
 * Russian pluralization rules:
 *   1, 21, 31... → `one`   (1 день, 21 день)
 *   2-4, 22-24...→ `few`   (2 дня, 22 дня)
 *   0, 5-20, 25+→ `many`  (5 дней, 11 дней, 25 дней)
 *
 * Usage: pluralRu(3, 'день', 'дня', 'дней') → 'дня'
 */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.floor(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * Format a duration with correct Russian or English grammar.
 * Unlike the scheduler's formatDuration (which uses abbreviated ч/м),
 * this returns full words: "2 часа", "1 час", "45 минут", "1 час 30 минут".
 */
export function formatDurationWords(minutes: number, lang: 'en' | 'ru' = 'en'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'ru') {
    const hStr = h > 0 ? `${h} ${pluralRu(h, 'час', 'часа', 'часов')}` : '';
    const mStr = m > 0 ? `${m} ${pluralRu(m, 'минута', 'минуты', 'минут')}` : '';
    return [hStr, mStr].filter(Boolean).join(' ') || '0 минут';
  }
  const hStr = h > 0 ? `${h}h` : '';
  const mStr = m > 0 ? `${m}m` : '';
  return [hStr, mStr].filter(Boolean).join(' ') || '0m';
}
