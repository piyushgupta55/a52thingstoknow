-- Add gender column to chapter_templates so we can store separate
-- female and male versions of each numbered chapter.
ALTER TABLE public.chapter_templates
  ADD COLUMN IF NOT EXISTS gender text;

-- Add direct verse and quote columns so the printed text can live
-- alongside the wisdom content (sourced from the printed books).
ALTER TABLE public.chapter_templates
  ADD COLUMN IF NOT EXISTS bible_verse_text text,
  ADD COLUMN IF NOT EXISTS bible_verse_reference text,
  ADD COLUMN IF NOT EXISTS quote_text text,
  ADD COLUMN IF NOT EXISTS quote_attribution text;

-- Backfill existing rows as the female set (current data leans female).
UPDATE public.chapter_templates SET gender = 'female' WHERE gender IS NULL;

-- Drop any old uniqueness on chapter_number alone, then enforce
-- uniqueness on (chapter_number, gender).
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.chapter_templates'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.chapter_templates DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.chapter_templates
  ADD CONSTRAINT chapter_templates_chapter_number_gender_key
  UNIQUE (chapter_number, gender);

-- After backfill, gender is required.
ALTER TABLE public.chapter_templates
  ALTER COLUMN gender SET NOT NULL;

-- Constrain gender to the two values we use.
ALTER TABLE public.chapter_templates
  DROP CONSTRAINT IF EXISTS chapter_templates_gender_check;
ALTER TABLE public.chapter_templates
  ADD CONSTRAINT chapter_templates_gender_check
  CHECK (gender IN ('female', 'male'));