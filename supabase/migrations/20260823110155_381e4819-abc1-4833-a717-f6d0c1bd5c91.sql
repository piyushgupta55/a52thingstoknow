CREATE TABLE public.chapter_passage_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  passage_key text NOT NULL,
  variant_key text NOT NULL,
  applied_body text,
  previous_content text,
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, passage_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_passage_selections TO authenticated;
GRANT ALL ON public.chapter_passage_selections TO service_role;

ALTER TABLE public.chapter_passage_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors manage passage selections for their books"
ON public.chapter_passage_selections FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.user_id = auth.uid()));

CREATE POLICY "Admins can view passage selections"
ON public.chapter_passage_selections FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_chapter_passage_selections_updated_at
BEFORE UPDATE ON public.chapter_passage_selections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();