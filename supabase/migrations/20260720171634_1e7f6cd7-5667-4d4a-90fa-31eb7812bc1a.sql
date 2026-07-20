
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS photo_declined boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reading_reward_decision text
    CHECK (reading_reward_decision IN ('keep','change','remove'));
