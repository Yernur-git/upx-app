# UpX — AI Daily Planner

A personal daily planner PWA with AI assistant, focus timer, and smart scheduling.

## Features

- **Tasks & Schedule** — Add tasks by text or voice. AI builds your daily timeline with breaks.
- **AI Assistant** — Chat with AI to plan your day, get suggestions, and review progress.
- **Focus Timer** — Pomodoro timer with per-task time tracking.
- **Morning & Evening Rituals** — Mood check-ins, morning briefing, evening day review.
- **Weekly Stats** — Track completion rates, streaks, and category balance.
- **Push Notifications** — Morning briefing and task reminders via Web Push.
- **Offline Support** — Works without an account using local storage.
- **Dark Mode** — Full light/dark theme support.
- **Bilingual** — English and Russian.

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 19, TypeScript, Zustand       |
| Styling     | CSS variables, inline styles        |
| Backend     | Vercel Serverless Functions          |
| Database    | Supabase (Postgres + Row-Level Security) |
| AI          | Anthropic, OpenAI, OpenRouter, Groq |
| Voice       | ElevenLabs TTS, Web Speech API      |
| Analytics   | PostHog (anonymous)                 |
| PWA         | Vite PWA + Workbox                  |

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Environment Variables

### Client-side (`.env`)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_POSTHOG_KEY=your-posthog-key     # optional
```

### Server-side (Vercel env vars)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI providers (at least one)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...

# Push notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_CONTACT=mailto:you@example.com
CRON_SECRET=any-random-string

# Voice (optional)
ELEVENLABS_API_KEY=...
```

## Project Structure

```
src/
  components/       # React components
    auth/           # Auth screens
    chat/           # AI chat panel
    focus/          # Focus timer
    legal/          # Privacy & Terms
    panels/         # Stats, Profile panels
    tasks/          # Task list, cards, quick-add
    timeline/       # Daily schedule timeline
  lib/              # Core logic
    ai.ts           # AI chat + response parser
    scheduler.ts    # Schedule builder
    errors.ts       # Humanized error messages
    push.ts         # Push notification client
    notifications.ts # Local notifications
    analytics.ts    # PostHog wrapper
    i18n.ts         # Translations
    supabase.ts     # Supabase client
    voice.ts        # TTS
  store/            # Zustand state management
  types/            # TypeScript types
  sw.ts             # Service worker
api/                # Vercel serverless functions
  chat.ts           # AI proxy with auth + rate limiting
  tts.ts            # ElevenLabs proxy
  push/             # Push notification endpoints
supabase/           # Database migrations
```

## Scripts

| Command          | Description               |
|------------------|---------------------------|
| `npm run dev`    | Start dev server          |
| `npm run build`  | Typecheck + production build |
| `npm test`       | Run tests (vitest)        |
| `npm run lint`   | ESLint check              |

## License

Private project.
