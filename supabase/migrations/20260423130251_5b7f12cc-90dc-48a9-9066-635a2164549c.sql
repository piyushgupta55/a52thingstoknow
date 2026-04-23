
-- 1. Extend memories table
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS contributor_type text NOT NULL DEFAULT 'author',
  ADD COLUMN IF NOT EXISTS placed_at timestamptz;

-- Migrate legacy 'pending' status → 'unplaced' (was used as default before spec)
UPDATE public.memories SET status = 'unplaced' WHERE status = 'pending' AND chapter_id IS NULL;
UPDATE public.memories SET status = 'placed' WHERE status = 'pending' AND chapter_id IS NOT NULL;

-- New default for status
ALTER TABLE public.memories ALTER COLUMN status SET DEFAULT 'unplaced';

-- 2. Memory invites table
CREATE TABLE IF NOT EXISTS public.memory_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_memory_invites_token ON public.memory_invites(token);
CREATE INDEX IF NOT EXISTS idx_memory_invites_book ON public.memory_invites(book_id);

ALTER TABLE public.memory_invites ENABLE ROW LEVEL SECURITY;

-- Owners manage their own invites
CREATE POLICY "Owners view their invites" ON public.memory_invites FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = memory_invites.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Owners create invites" ON public.memory_invites FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.books WHERE books.id = memory_invites.book_id AND books.user_id = auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Owners update invites" ON public.memory_invites FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = memory_invites.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Owners delete invites" ON public.memory_invites FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = memory_invites.book_id AND books.user_id = auth.uid()));

-- 3. Public lookup function for an invite (security definer; returns only safe fields)
CREATE OR REPLACE FUNCTION public.get_invite_context(_token text)
RETURNS TABLE (book_id uuid, recipient_name text, author_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.recipient_name,
         COALESCE(p.display_name, b.from_label, 'The Author') AS author_name
  FROM public.memory_invites i
  JOIN public.books b ON b.id = i.book_id
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  WHERE i.token = _token AND i.revoked_at IS NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_context(text) TO anon, authenticated;

-- 4. Public memory submission via invite token (security definer — bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.submit_memory_via_invite(
  _token text,
  _from_name text,
  _memory_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_id uuid;
  v_size text;
  v_sentences int;
  v_id uuid;
BEGIN
  -- Validate invite
  SELECT book_id INTO v_book_id
  FROM public.memory_invites
  WHERE token = _token AND revoked_at IS NULL
  LIMIT 1;

  IF v_book_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or revoked invite';
  END IF;

  -- Basic validation
  IF length(trim(coalesce(_from_name, ''))) = 0 OR length(trim(coalesce(_memory_text, ''))) = 0 THEN
    RAISE EXCEPTION 'Name and memory are required';
  END IF;

  IF length(_memory_text) > 5000 THEN
    RAISE EXCEPTION 'Memory too long';
  END IF;

  -- Auto size
  v_sentences := array_length(regexp_split_to_array(trim(_memory_text), '[.!?]+\s'), 1);
  v_size := CASE
    WHEN v_sentences <= 1 THEN 'small'
    WHEN v_sentences <= 3 THEN 'medium'
    ELSE 'full'
  END;

  INSERT INTO public.memories (book_id, contributor_name, contributor_type, memory_text, size_tag, status)
  VALUES (v_book_id, trim(_from_name), 'family', trim(_memory_text), v_size, 'pending_approval')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_memory_via_invite(text, text, text) TO anon, authenticated;
