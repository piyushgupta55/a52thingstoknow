CREATE TABLE public.chapter_passage_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  passage_key text NOT NULL,
  gender text NOT NULL,
  chapter_number integer NOT NULL,
  variant_key text NOT NULL,
  label text NOT NULL,
  explanation text,
  body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (passage_key, gender, variant_key)
);

GRANT SELECT ON public.chapter_passage_variants TO authenticated;
GRANT ALL ON public.chapter_passage_variants TO service_role;

ALTER TABLE public.chapter_passage_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read passage variants"
  ON public.chapter_passage_variants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage passage variants"
  ON public.chapter_passage_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_chapter_passage_variants_updated_at
  BEFORE UPDATE ON public.chapter_passage_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();