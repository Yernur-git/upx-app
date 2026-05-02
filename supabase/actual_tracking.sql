-- Run this in Supabase → SQL Editor
-- Adds actual time-tracking columns to the tasks table.
-- These are populated automatically when the user stops a Focus session.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS actual_start_time       text;

-- Also add focus_minutes to day_stats so it persists across sessions
ALTER TABLE public.day_stats
  ADD COLUMN IF NOT EXISTS focus_minutes integer NOT NULL DEFAULT 0;
