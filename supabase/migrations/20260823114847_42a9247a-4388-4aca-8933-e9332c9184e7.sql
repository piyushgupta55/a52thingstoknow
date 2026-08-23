ALTER TABLE public.chapter_templates ADD COLUMN IF NOT EXISTS template_key text;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS template_key text;
ALTER TABLE public.chapter_passage_variants ADD COLUMN IF NOT EXISTS template_key text;

UPDATE public.chapter_templates
   SET template_key = trim(both '-' from lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g')))
 WHERE template_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chapter_templates_gender_template_key_idx
  ON public.chapter_templates (gender, template_key);

UPDATE public.chapters c
   SET template_key = t.template_key
  FROM public.books b, public.chapter_templates t
 WHERE b.id = c.book_id
   AND t.gender = b.gender
   AND lower(regexp_replace(t.title, '[^a-zA-Z0-9]+', '', 'g')) = lower(regexp_replace(c.title, '[^a-zA-Z0-9]+', '', 'g'))
   AND c.chapter_number > 0
   AND c.template_key IS NULL;

UPDATE public.chapters
   SET template_key = 'opening-letter'
 WHERE chapter_number = 0 AND template_key IS NULL;

CREATE INDEX IF NOT EXISTS chapters_template_key_idx ON public.chapters (template_key);

UPDATE public.chapter_passage_variants
   SET template_key = 'respect'
 WHERE template_key IS NULL AND chapter_number = 29;

CREATE INDEX IF NOT EXISTS chapter_passage_variants_key_idx
  ON public.chapter_passage_variants (template_key, gender, passage_key);