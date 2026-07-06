
-- 1. book_status enum
CREATE TYPE public.book_status AS ENUM ('in_progress', 'ready', 'approved_for_print', 'printed', 'shipped');

-- 2. books: status + deferred columns
ALTER TABLE public.books
  ADD COLUMN status public.book_status NOT NULL DEFAULT 'in_progress',
  ADD COLUMN cover_pick text,
  ADD COLUMN print_sku text,
  ADD COLUMN quantity integer,
  ADD COLUMN ingramspark_job_id text,
  ADD COLUMN tracking_number text,
  ADD COLUMN carrier text,
  ADD COLUMN consent_granted_at timestamptz,
  ADD COLUMN shipping_address jsonb;

-- 3. book_status_history
CREATE TABLE public.book_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  status public.book_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_book_status_history_book_id ON public.book_status_history(book_id);

GRANT SELECT, INSERT ON public.book_status_history TO authenticated;
GRANT ALL ON public.book_status_history TO service_role;

ALTER TABLE public.book_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own book status history"
  ON public.book_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.user_id = auth.uid()));

CREATE POLICY "Admins view all book status history"
  ON public.book_status_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert book status history"
  ON public.book_status_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. profiles: email + email_verified
ALTER TABLE public.profiles
  ADD COLUMN email text,
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;

-- Backfill from auth.users
UPDATE public.profiles p
SET email = u.email,
    email_verified = (u.email_confirmed_at IS NOT NULL)
FROM auth.users u
WHERE p.user_id = u.id;

-- 5. Update handle_new_user to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, email_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    (NEW.email_confirmed_at IS NOT NULL)
  );
  RETURN NEW;
END;
$function$;

-- 6. Sync email/verification changes from auth.users -> profiles
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
     SET email = NEW.email,
         email_verified = (NEW.email_confirmed_at IS NOT NULL)
   WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_to_profile();

-- 7. Admin read policies on books + profiles
CREATE POLICY "Admins view all books"
  ON public.books FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can read chapters/memories of any book (for tester content viewing)
CREATE POLICY "Admins view all chapters"
  ON public.chapters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all memories"
  ON public.memories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
