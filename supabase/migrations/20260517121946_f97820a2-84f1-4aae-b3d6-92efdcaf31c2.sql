
-- Table to store the "Where You Come From" ancestry section per book
CREATE TABLE public.book_ancestry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid NOT NULL UNIQUE,
  content text,
  pdf_url text,
  pdf_filename text,
  status text NOT NULL DEFAULT 'not_started',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.book_ancestry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ancestry for their own books"
ON public.book_ancestry FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = book_ancestry.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can insert ancestry for their own books"
ON public.book_ancestry FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.books WHERE books.id = book_ancestry.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can update ancestry for their own books"
ON public.book_ancestry FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = book_ancestry.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can delete ancestry for their own books"
ON public.book_ancestry FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = book_ancestry.book_id AND books.user_id = auth.uid()));

CREATE TRIGGER book_ancestry_set_updated_at
BEFORE UPDATE ON public.book_ancestry
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for ancestry PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('ancestry-pdfs', 'ancestry-pdfs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Ancestry PDFs are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'ancestry-pdfs');

CREATE POLICY "Authenticated users can upload ancestry PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ancestry-pdfs');

CREATE POLICY "Authenticated users can update ancestry PDFs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ancestry-pdfs');

CREATE POLICY "Authenticated users can delete ancestry PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ancestry-pdfs');
