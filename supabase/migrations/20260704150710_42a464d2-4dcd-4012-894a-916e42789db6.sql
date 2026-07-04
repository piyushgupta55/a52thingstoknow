
-- 1. chapter_templates: consolidate content into a single column
ALTER TABLE public.chapter_templates ADD COLUMN IF NOT EXISTS reference_content TEXT;

UPDATE public.chapter_templates
SET reference_content = CASE
  WHEN gender = 'female' THEN reference_content_female
  WHEN gender = 'male'   THEN reference_content_male
  ELSE reference_content
END
WHERE reference_content IS NULL;

ALTER TABLE public.chapter_templates DROP COLUMN IF EXISTS reference_content_female;
ALTER TABLE public.chapter_templates DROP COLUMN IF EXISTS reference_content_male;

-- Unique key so CSV upserts on (gender, chapter_number) are idempotent
CREATE UNIQUE INDEX IF NOT EXISTS chapter_templates_gender_chapter_key
  ON public.chapter_templates (gender, chapter_number);

-- 2. chapters: seed_content — frozen original at book creation, write-once
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS seed_content TEXT;

-- 3. chapter_review_flags: editor-only Keep/Soften/Remove flag per <review> span
CREATE TABLE IF NOT EXISTS public.chapter_review_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  tag_index INTEGER NOT NULL,
  action TEXT NOT NULL DEFAULT 'keep',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, tag_index)
);

-- Validate action values via trigger (avoid CHECK for future-flex)
CREATE OR REPLACE FUNCTION public.validate_review_flag_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.action NOT IN ('keep','soften','remove') THEN
    RAISE EXCEPTION 'Invalid review flag action: %', NEW.action;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_review_flag ON public.chapter_review_flags;
CREATE TRIGGER trg_validate_review_flag
  BEFORE INSERT OR UPDATE ON public.chapter_review_flags
  FOR EACH ROW EXECUTE FUNCTION public.validate_review_flag_action();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_review_flags TO authenticated;
GRANT ALL ON public.chapter_review_flags TO service_role;

ALTER TABLE public.chapter_review_flags ENABLE ROW LEVEL SECURITY;

-- Owners of the book (via chapters -> books.user_id) can manage their flags
CREATE POLICY "Users manage review flags for their own chapters"
  ON public.chapter_review_flags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chapters c
      JOIN public.books b ON b.id = c.book_id
      WHERE c.id = chapter_review_flags.chapter_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chapters c
      JOIN public.books b ON b.id = c.book_id
      WHERE c.id = chapter_review_flags.chapter_id
        AND b.user_id = auth.uid()
    )
  );
