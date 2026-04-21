
-- AI conversation messages
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system','user','assistant')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_conv_book ON public.ai_conversations(book_id);
CREATE INDEX idx_ai_conv_chapter ON public.ai_conversations(chapter_id);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON public.ai_conversations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM books WHERE books.id = ai_conversations.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can create their own conversations"
  ON public.ai_conversations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = ai_conversations.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can update their own conversations"
  ON public.ai_conversations FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM books WHERE books.id = ai_conversations.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can delete their own conversations"
  ON public.ai_conversations FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM books WHERE books.id = ai_conversations.book_id AND books.user_id = auth.uid()));

-- Onboarding step on books
ALTER TABLE public.books ADD COLUMN onboarding_step text NOT NULL DEFAULT 'new';

-- Chapter triage status
ALTER TABLE public.chapters ADD COLUMN triage text DEFAULT NULL;
