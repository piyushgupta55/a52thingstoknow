CREATE TABLE public.book_print_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at timestamp with time zone NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.book_print_approvals TO authenticated;
GRANT ALL ON public.book_print_approvals TO service_role;

ALTER TABLE public.book_print_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view approvals for their own books"
  ON public.book_print_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.user_id = auth.uid()));

CREATE POLICY "Users create approvals for their own books"
  ON public.book_print_approvals FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.user_id = auth.uid())
  );

CREATE POLICY "Admins view all print approvals"
  ON public.book_print_approvals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_book_print_approvals_book ON public.book_print_approvals(book_id, approved_at DESC);