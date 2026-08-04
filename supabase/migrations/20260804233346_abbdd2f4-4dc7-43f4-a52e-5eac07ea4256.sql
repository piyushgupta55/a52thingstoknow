UPDATE public.chapters SET reading_reward_decision = NULL WHERE reading_reward_decision = '';

ALTER TABLE public.chapters
  DROP CONSTRAINT IF EXISTS chapters_reading_reward_decision_check;

ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_reading_reward_decision_check
  CHECK (
    reading_reward_decision IS NULL
    OR reading_reward_decision IN ('keep','change','remove','acknowledged')
  );