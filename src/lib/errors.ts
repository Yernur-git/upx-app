/**
 * Turn technical errors (Supabase, fetch, API proxy) into user-friendly
 * messages. Falls back to the original message for unrecognised errors so
 * we don't hide useful debug info during development.
 */

type Lang = 'en' | 'ru';

function detectLang(): Lang {
  if (typeof navigator !== 'undefined' && /^ru\b/i.test(navigator.language ?? '')) return 'ru';
  return 'en';
}

interface Pattern {
  match: RegExp;
  en: string;
  ru: string;
}

// Order matters — first match wins. Be specific before generic.
const PATTERNS: Pattern[] = [
  // ── Auth ──────────────────────────────────────────────────────────
  {
    match: /invalid login credentials|invalid_grant|wrong password/i,
    en: 'Wrong email or password.',
    ru: 'Неверный email или пароль.',
  },
  {
    match: /email not confirmed|email_not_confirmed/i,
    en: 'Confirm your email first — check your inbox for the link.',
    ru: 'Сначала подтвердите email — мы отправили ссылку на почту.',
  },
  {
    match: /user already registered|already exists|email.*already/i,
    en: 'This email is already registered — try signing in instead.',
    ru: 'Email уже зарегистрирован — попробуйте войти.',
  },
  {
    match: /password should be at least|password.*too short|weak password/i,
    en: 'Password is too short — use at least 8 characters.',
    ru: 'Пароль слишком короткий — минимум 8 символов.',
  },
  {
    match: /rate limit|too many requests|429/i,
    en: 'Too many attempts — wait a minute and try again.',
    ru: 'Слишком много попыток — подождите минуту.',
  },
  {
    match: /invalid email|email.*invalid|email_address_invalid/i,
    en: 'That doesn\'t look like a valid email.',
    ru: 'Похоже, email введён неверно.',
  },
  {
    match: /session expired|jwt expired|AUTH_INVALID/i,
    en: 'Your session expired — sign in again.',
    ru: 'Сессия истекла — войдите заново.',
  },
  {
    match: /AUTH_REQUIRED/i,
    en: 'Sign in to use AI features, or add your own API key in Profile.',
    ru: 'Войдите чтобы пользоваться ИИ, или добавьте свой API-ключ в Профиле.',
  },

  // ── AI / API proxy ────────────────────────────────────────────────
  {
    match: /RATE_LIMITED/i,
    en: 'You\'ve hit the AI rate limit — wait a minute.',
    ru: 'Лимит запросов к ИИ — подождите минуту.',
  },
  {
    match: /PAYLOAD_TOO_LARGE/i,
    en: 'Message is too long — shorten it and try again.',
    ru: 'Сообщение слишком длинное — сократите и попробуйте снова.',
  },
  {
    match: /KEY_NOT_CONFIGURED/i,
    en: 'Server AI key not configured. Add your own in Profile → AI Settings.',
    ru: 'Серверный ключ ИИ не настроен. Добавьте свой в Профиле → ИИ.',
  },
  {
    match: /UPSTREAM_FETCH_FAILED|network|fetch failed|failed to fetch/i,
    en: 'Network problem — check your internet connection.',
    ru: 'Проблема с сетью — проверьте интернет.',
  },
  {
    match: /UPSTREAM_ERROR|provider/i,
    en: 'AI provider returned an error — try again in a moment.',
    ru: 'Провайдер ИИ вернул ошибку — попробуйте ещё раз.',
  },
  {
    match: /TTS_UPSTREAM|elevenlabs/i,
    en: 'Voice synthesis unavailable right now.',
    ru: 'Озвучка временно недоступна.',
  },

  // ── Generic ──────────────────────────────────────────────────────
  {
    match: /timeout|timed out/i,
    en: 'Request took too long — try again.',
    ru: 'Запрос занял слишком долго — попробуйте снова.',
  },
  {
    match: /not authorized|forbidden|403/i,
    en: 'You don\'t have permission for this action.',
    ru: 'Нет прав на это действие.',
  },
];

export function humanizeError(err: unknown, lang?: Lang): string {
  const language = lang ?? detectLang();
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
  for (const p of PATTERNS) {
    if (p.match.test(raw)) return language === 'ru' ? p.ru : p.en;
  }
  // Fallback — keep the raw message but cap length so we don't dump a stack trace.
  return raw.length > 200 ? raw.slice(0, 197) + '…' : raw;
}
