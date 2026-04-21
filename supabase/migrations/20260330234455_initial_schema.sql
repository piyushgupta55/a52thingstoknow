-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create books table
CREATE TYPE public.relationship_type AS ENUM (
  'Daughter', 'Son', 'Stepdaughter', 'Stepson', 
  'Granddaughter', 'Grandson', 'Niece', 'Nephew', 'Family Friend'
);
CREATE TYPE public.recipient_gender AS ENUM ('Girl/Young Woman', 'Boy/Young Man');
CREATE TYPE public.occasion_type AS ENUM ('High School Graduation', '18th Birthday', 'Other Milestone');
CREATE TYPE public.writing_tone AS ENUM (
  'Warm and Conversational', 'Formal and Thoughtful', 
  'Warm and Humorous', 'Poetic and Reflective'
);

CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_name text NOT NULL,
  relationship relationship_type NOT NULL,
  recipient_gender recipient_gender NOT NULL,
  occasion occasion_type NOT NULL,
  milestone_date date,
  writing_tone writing_tone NOT NULL DEFAULT 'Warm and Conversational',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Create chapters table
CREATE TYPE public.chapter_status AS ENUM ('not_started', 'in_progress', 'complete');

CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
  chapter_number integer NOT NULL CHECK (chapter_number >= 1 AND chapter_number <= 52),
  title text NOT NULL,
  bible_verse_text text,
  bible_verse_reference text,
  quote_text text,
  quote_attribution text,
  content text,
  photo_urls text[] DEFAULT '{}',
  status chapter_status DEFAULT 'not_started' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(book_id, chapter_number)
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.user_owns_book(_book_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.books WHERE id = _book_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_chapter(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chapters c
    JOIN public.books b ON b.id = c.book_id
    WHERE c.id = _chapter_id AND b.user_id = auth.uid()
  );
$$;

-- RLS Policies
-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Books
CREATE POLICY "Users can view own books" ON public.books FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own books" ON public.books FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own books" ON public.books FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own books" ON public.books FOR DELETE USING (user_id = auth.uid());

-- Chapters
CREATE POLICY "Users can view own chapters" ON public.chapters FOR SELECT USING (public.user_owns_book(book_id));
CREATE POLICY "Users can insert own chapters" ON public.chapters FOR INSERT WITH CHECK (public.user_owns_book(book_id));
CREATE POLICY "Users can update own chapters" ON public.chapters FOR UPDATE USING (public.user_owns_book(book_id));
CREATE POLICY "Users can delete own chapters" ON public.chapters FOR DELETE USING (public.user_owns_book(book_id));

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for chapter photos
INSERT INTO storage.buckets (id, name, public) VALUES ('chapter-photos', 'chapter-photos', true);

CREATE POLICY "Users can upload chapter photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chapter-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Anyone can view chapter photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'chapter-photos');
CREATE POLICY "Users can delete own chapter photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'chapter-photos' AND auth.role() = 'authenticated');
