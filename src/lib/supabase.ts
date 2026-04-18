import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── SQL to run in Supabase Dashboard → SQL Editor ───────────────────────────
//
// create table public.tasks (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references auth.users(id) on delete cascade,
//   title text not null,
//   duration_minutes integer not null default 30,
//   break_after integer not null default 0,
//   travel_minutes integer not null default 0,
//   priority text not null default 'medium',
//   category text not null default 'general',
//   is_starred boolean not null default false,
//   is_done boolean not null default false,
//   day text not null default 'today',
//   fixed_time text,
//   notes text,
//   sort_order integer not null default 0,
//   created_at timestamptz not null default now()
// );
//
// alter table public.tasks enable row level security;
//
// create policy "Users manage own tasks"
//   on public.tasks for all
//   using (auth.uid() = user_id)
//   with check (auth.uid() = user_id);
//
// create table public.user_config (
//   user_id uuid primary key references auth.users(id) on delete cascade,
//   wake text not null default '07:00',
//   sleep text not null default '23:00',
//   buffer integer not null default 5,
//   theme text not null default 'light',
//   gym_travel_minutes integer not null default 0,
//   known_contexts jsonb not null default '{}',
//   updated_at timestamptz not null default now()
// );
//
// alter table public.user_config enable row level security;
//
// create policy "Users manage own config"
//   on public.user_config for all
//   using (auth.uid() = user_id)
//   with check (auth.uid() = user_id);
//
// ─────────────────────────────────────────────────────────────────────────────
