ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_gender_check;
ALTER TABLE public.books ADD CONSTRAINT books_gender_check
  CHECK (gender IN ('female','male','stepdaughter','stepson'));

ALTER TABLE public.chapter_passage_variants DROP CONSTRAINT IF EXISTS chapter_passage_variants_gender_check;
ALTER TABLE public.chapter_passage_variants ADD CONSTRAINT chapter_passage_variants_gender_check
  CHECK (gender IN ('female','male','stepdaughter','stepson'));