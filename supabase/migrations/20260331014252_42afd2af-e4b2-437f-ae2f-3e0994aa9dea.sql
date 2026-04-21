
-- Create verse_library table for future alternatives
CREATE TABLE public.verse_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verse_text TEXT NOT NULL,
  verse_reference TEXT NOT NULL,
  chapter_topics TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.verse_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verse library is readable by authenticated users"
  ON public.verse_library FOR SELECT
  TO authenticated
  USING (true);

-- Create quote_library table for future alternatives
CREATE TABLE public.quote_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_text TEXT NOT NULL,
  quote_attribution TEXT NOT NULL,
  chapter_topics TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quote library is readable by authenticated users"
  ON public.quote_library FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for topic searches
CREATE INDEX idx_verse_library_topics ON public.verse_library USING GIN(chapter_topics);
CREATE INDEX idx_quote_library_topics ON public.quote_library USING GIN(chapter_topics);
