CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipient_name text NOT NULL,
  relationship text NOT NULL,
  recipient_gender text NOT NULL,
  occasion text NOT NULL,
  milestone_date date,
  writing_tone text NOT NULL DEFAULT 'Warm and Conversational',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON public.books(user_id);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own books" ON public.books;
CREATE POLICY "Users can view their own books"
ON public.books
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own books" ON public.books;
CREATE POLICY "Users can create their own books"
ON public.books
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own books" ON public.books;
CREATE POLICY "Users can update their own books"
ON public.books
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own books" ON public.books;
CREATE POLICY "Users can delete their own books"
ON public.books
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_books_updated_at ON public.books;
CREATE TRIGGER set_books_updated_at
BEFORE UPDATE ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_number integer NOT NULL,
  title text NOT NULL,
  bible_verse_text text,
  bible_verse_reference text,
  quote_text text,
  quote_attribution text,
  content text,
  photo_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapters_status_check CHECK (status IN ('not_started', 'in_progress', 'complete')),
  CONSTRAINT chapters_number_check CHECK (chapter_number BETWEEN 1 AND 52),
  CONSTRAINT chapters_book_number_key UNIQUE (book_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON public.chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_book_status ON public.chapters(book_id, status);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view chapters for their own books" ON public.chapters;
CREATE POLICY "Users can view chapters for their own books"
ON public.chapters
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.books
    WHERE books.id = chapters.book_id
      AND books.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create chapters for their own books" ON public.chapters;
CREATE POLICY "Users can create chapters for their own books"
ON public.chapters
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.books
    WHERE books.id = chapters.book_id
      AND books.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update chapters for their own books" ON public.chapters;
CREATE POLICY "Users can update chapters for their own books"
ON public.chapters
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.books
    WHERE books.id = chapters.book_id
      AND books.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.books
    WHERE books.id = chapters.book_id
      AND books.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete chapters for their own books" ON public.chapters;
CREATE POLICY "Users can delete chapters for their own books"
ON public.chapters
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.books
    WHERE books.id = chapters.book_id
      AND books.user_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS set_chapters_updated_at ON public.chapters;
CREATE TRIGGER set_chapters_updated_at
BEFORE UPDATE ON public.chapters
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();