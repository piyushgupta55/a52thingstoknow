-- Add gender column to books, derived from existing recipient_gender
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS gender text;

-- Backfill from recipient_gender (Girl/Young Woman -> female, Boy/Young Man -> male)
UPDATE public.books
SET gender = CASE
  WHEN recipient_gender ILIKE '%girl%' OR recipient_gender ILIKE '%woman%' OR recipient_gender ILIKE '%female%' THEN 'female'
  WHEN recipient_gender ILIKE '%boy%' OR recipient_gender ILIKE '%man%' OR recipient_gender ILIKE '%male%' THEN 'male'
  ELSE 'female'
END
WHERE gender IS NULL;

-- Make required and constrain values
ALTER TABLE public.books
  ALTER COLUMN gender SET NOT NULL;

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_gender_check;

ALTER TABLE public.books
  ADD CONSTRAINT books_gender_check
  CHECK (gender IN ('female', 'male'));