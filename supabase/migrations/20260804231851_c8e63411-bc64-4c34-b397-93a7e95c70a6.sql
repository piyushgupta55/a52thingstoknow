ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS reading_reward_ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS reading_reward_ack_by uuid;