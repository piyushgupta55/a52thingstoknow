
-- Drop existing tables to rebuild with correct schema
DROP TABLE IF EXISTS public.verse_library CASCADE;
DROP TABLE IF EXISTS public.quote_library CASCADE;

-- Create verse_library
CREATE TABLE public.verse_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verse_text TEXT NOT NULL,
  reference TEXT NOT NULL,
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'system',
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.verse_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verse library is readable by authenticated users"
  ON public.verse_library FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_verse_library_topic_tags ON public.verse_library USING GIN(topic_tags);

-- Create quote_library
CREATE TABLE public.quote_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_text TEXT NOT NULL,
  attribution TEXT NOT NULL,
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'system',
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quote library is readable by authenticated users"
  ON public.quote_library FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_quote_library_topic_tags ON public.quote_library USING GIN(topic_tags);

-- Create chapter_templates
CREATE TABLE public.chapter_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  default_verse_id UUID REFERENCES public.verse_library(id) ON DELETE SET NULL,
  default_quote_id UUID REFERENCES public.quote_library(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chapter_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapter templates are readable by authenticated users"
  ON public.chapter_templates FOR SELECT TO authenticated USING (true);

-- Add verse/quote library reference columns to chapters table
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS verse_id UUID REFERENCES public.verse_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quote_library(id) ON DELETE SET NULL;

-- Function to increment times_used counters
CREATE OR REPLACE FUNCTION public.increment_usage_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verse_id IS NOT NULL AND (OLD.verse_id IS DISTINCT FROM NEW.verse_id) THEN
    UPDATE public.verse_library SET times_used = times_used + 1 WHERE id = NEW.verse_id;
    IF OLD.verse_id IS NOT NULL THEN
      UPDATE public.verse_library SET times_used = GREATEST(0, times_used - 1) WHERE id = OLD.verse_id;
    END IF;
  END IF;

  IF NEW.quote_id IS NOT NULL AND (OLD.quote_id IS DISTINCT FROM NEW.quote_id) THEN
    UPDATE public.quote_library SET times_used = times_used + 1 WHERE id = NEW.quote_id;
    IF OLD.quote_id IS NOT NULL THEN
      UPDATE public.quote_library SET times_used = GREATEST(0, times_used - 1) WHERE id = OLD.quote_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to track usage on chapter save
CREATE TRIGGER track_library_usage
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_usage_counter();
