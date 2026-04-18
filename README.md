# UpX — AI Daily Planner

Smart daily planner with an AI assistant that understands natural language tasks and builds your schedule automatically.

## Features

- 📝 **Natural language tasks** — type "edit video 60min" and AI creates the task
- 🗓️ **Auto-scheduling** — AI builds your day considering travel, breaks, priorities
- 💬 **AI chat advisor** — ask for help, reschedule, get productivity advice
- ⏱️ **Live timeline** — visual schedule with current time indicator
- 🌙 **Dark mode** — full light/dark theme support
- ☁️ **Supabase sync** — data syncs across all your devices (when configured)

---

## Quick Start

### 1. Install
```bash
npm install
```

### 2. Set up Supabase (optional for cloud sync)
1. Go to supabase.com → New project
2. Run the SQL from `src/lib/supabase.ts` in SQL Editor
3. Copy your Project URL and anon key

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 3. Run
```bash
npm run dev
```

### 4. Add Anthropic API Key
In the app → Settings (gear icon) → paste your `sk-ant-...` key.
Get one at console.anthropic.com

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```
Then add env vars in Vercel dashboard. Auto-deploys on every GitHub push.

---

## Project Structure

```
src/
├── components/
│   ├── layout/       SidebarHeader (greeting, settings, theme toggle)
│   ├── tasks/        TaskList, TaskCard, AddTaskForm
│   ├── timeline/     Timeline with hour markers & task blocks
│   └── chat/         ChatPanel — floating AI assistant
├── lib/
│   ├── ai.ts         Claude API integration + system prompt
│   ├── scheduler.ts  Core scheduling algorithm
│   └── supabase.ts   Supabase client + SQL schema comments
├── store/
│   └── index.ts      Zustand global state (persists to localStorage)
├── types/
│   └── index.ts      All TypeScript types
└── styles/
    └── globals.css   Design tokens (light/dark) + global styles
```

---

## How AI Works

The AI chat receives a full context with:
- All your tasks (titles, durations, travel times, priorities)
- Your wake/sleep times and break preferences
- Current time

It can:
- **Parse tasks** from natural language → returns JSON → task is created instantly
- **Build schedule** → arranges tasks optimally with breaks and travel
- **Advise** → suggest what to move, how to prioritize, reschedule overloaded days

---

## Roadmap

- [x] Phase 0 — React + TypeScript + Vite + Zustand
- [x] Phase 1 — Task list + Timeline
- [x] Phase 2 — AI Chat (Claude API)
- [ ] Phase 3 — Supabase auth + cloud sync
- [ ] Phase 4 — Recurring tasks, PWA, browser notifications
- [ ] Phase 5 — React Native (iOS + Android)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| State | Zustand + localStorage persist |
| Database | Supabase (PostgreSQL + RLS) |
| AI | Anthropic Claude API (claude-sonnet-4) |
| Icons | Lucide React |
| Hosting | Vercel |
| Mobile (future) | React Native + Expo |
