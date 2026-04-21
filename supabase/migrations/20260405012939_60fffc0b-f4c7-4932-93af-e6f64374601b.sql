
-- Create profiles table
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Content pool enums
CREATE TYPE public.content_type AS ENUM ('verse', 'quote', 'memory');
CREATE TYPE public.content_status AS ENUM ('pending', 'approved', 'deleted');
CREATE TYPE public.content_origin AS ENUM ('preloaded', 'ai_generated', 'author_written', 'family_submitted');

-- Content pool table
CREATE TABLE public.content_pool (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  type content_type NOT NULL,
  text text NOT NULL,
  source text,
  translation text,
  topic_tags text[] NOT NULL DEFAULT '{}',
  status content_status NOT NULL DEFAULT 'pending',
  origin content_origin NOT NULL DEFAULT 'preloaded',
  placed_in integer[] NOT NULL DEFAULT '{}',
  word_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.content_pool ENABLE ROW LEVEL SECURITY;

-- Admins can do everything on content_pool
CREATE POLICY "Admins can view all content" ON public.content_pool FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert content" ON public.content_pool FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update content" ON public.content_pool FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete content" ON public.content_pool FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Regular users can view approved content for their books or global
CREATE POLICY "Users can view approved content" ON public.content_pool FOR SELECT USING (
  status = 'approved' AND (book_id IS NULL OR EXISTS (SELECT 1 FROM books WHERE books.id = content_pool.book_id AND books.user_id = auth.uid()))
);

-- Users can create content for their own books
CREATE POLICY "Users can create content for their books" ON public.content_pool FOR INSERT WITH CHECK (
  book_id IS NOT NULL AND EXISTS (SELECT 1 FROM books WHERE books.id = content_pool.book_id AND books.user_id = auth.uid())
);

-- Auto-calculate word count
CREATE OR REPLACE FUNCTION public.calculate_word_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.word_count := array_length(regexp_split_to_array(trim(NEW.text), '\s+'), 1);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER content_pool_word_count
  BEFORE INSERT OR UPDATE OF text ON public.content_pool
  FOR EACH ROW EXECUTE FUNCTION public.calculate_word_count();

-- Index for common queries
CREATE INDEX idx_content_pool_type_status ON public.content_pool(type, status);
CREATE INDEX idx_content_pool_book_id ON public.content_pool(book_id);
CREATE INDEX idx_content_pool_topic_tags ON public.content_pool USING GIN(topic_tags);
