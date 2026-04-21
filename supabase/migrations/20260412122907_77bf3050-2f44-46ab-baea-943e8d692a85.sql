ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS chapters_number_check;

ALTER TABLE public.chapters ADD CONSTRAINT chapters_number_check CHECK (chapter_number >= 0);