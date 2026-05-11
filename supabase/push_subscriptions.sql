-- Run this in Supabase → SQL Editor
-- Stores web-push subscriptions for the cron-driven morning briefings and
-- task reminders. RLS is critical here: without it, the anon publishable key
-- would be able to read every user's push endpoint and tz_offset.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text        NOT NULL PRIMARY KEY,
  subscription jsonb       NOT NULL,
  tz_offset    integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own subscription rows. The Vercel cron and
-- the /api/push/* endpoints use the service-role key which bypasses RLS.
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
