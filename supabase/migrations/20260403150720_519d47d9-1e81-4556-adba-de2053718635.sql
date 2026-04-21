
-- Add chapter_template to chapters
ALTER TABLE public.chapters 
ADD COLUMN chapter_template TEXT NOT NULL DEFAULT 'all_words';

-- Create memories table
CREATE TABLE public.memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  contributor_name TEXT NOT NULL,
  memory_text TEXT NOT NULL,
  size_tag TEXT NOT NULL DEFAULT 'small',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- RLS policies for memories
CREATE POLICY "Users can view memories for their own books"
ON public.memories FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM books WHERE books.id = memories.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can create memories for their own books"
ON public.memories FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = memories.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can update memories for their own books"
ON public.memories FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM books WHERE books.id = memories.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can delete memories for their own books"
ON public.memories FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM books WHERE books.id = memories.book_id AND books.user_id = auth.uid()));
