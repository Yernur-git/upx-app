-- Run this in Supabase → SQL Editor

CREATE TABLE public.day_stats (
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          date        NOT NULL,
  total_count   integer     NOT NULL DEFAULT 0,
  done_count    integer     NOT NULL DEFAULT 0,
  total_minutes integer     NOT NULL DEFAULT 0,
  done_minutes  integer     NOT NULL DEFAULT 0,
  tasks         jsonb       NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.day_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own stats"
  ON public.day_stats FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
