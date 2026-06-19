CREATE TABLE public.book_family_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid NOT NULL UNIQUE REFERENCES public.books(id) ON DELETE CASCADE,
  content text,
  status text NOT NULL DEFAULT 'not_started',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_family_history TO authenticated;
GRANT ALL ON public.book_family_history TO service_role;

ALTER TABLE public.book_family_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view family history for their own books"
ON public.book_family_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = book_family_history.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can insert family history for their own books"
ON public.book_family_history FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.books WHERE books.id = book_family_history.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can update family history for their own books"
ON public.book_family_history FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = book_family_history.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can delete family history for their own books"
ON public.book_family_history FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = book_family_history.book_id AND books.user_id = auth.uid()));

CREATE TRIGGER book_family_history_set_updated_at
BEFORE UPDATE ON public.book_family_history
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();