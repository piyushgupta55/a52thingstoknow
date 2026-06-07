ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS review_status text;
ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS chapters_review_status_check;
ALTER TABLE public.chapters ADD CONSTRAINT chapters_review_status_check CHECK (review_status IS NULL OR review_status IN ('keep','add','rewrite'));