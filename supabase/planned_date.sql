-- Run this in Supabase → SQL Editor
-- Adds the planned_date column used for week-ahead scheduling.
-- Without this column, inserts of tasks scheduled for a specific future weekday
-- (e.g. "add meeting on Wednesday" via the AI or week strip) silently fail.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS planned_date text;
