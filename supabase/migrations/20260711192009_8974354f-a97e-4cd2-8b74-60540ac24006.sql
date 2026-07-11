
-- 1. Extend memories
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS contributor_email TEXT,
  ADD COLUMN IF NOT EXISTS entry_type TEXT,
  ADD COLUMN IF NOT EXISTS seen_by_author_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memories_entry_type_check') THEN
    ALTER TABLE public.memories
      ADD CONSTRAINT memories_entry_type_check
      CHECK (entry_type IS NULL OR entry_type IN ('memory','wisdom'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memories_book_family_unseen
  ON public.memories (book_id, seen_by_author_at)
  WHERE contributor_type = 'family';

-- 2. memory_invitees
CREATE TABLE IF NOT EXISTS public.memory_invitees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  invite_token TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS memory_invitees_book_email_key
  ON public.memory_invitees (book_id, lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_invitees TO authenticated;
GRANT ALL ON public.memory_invitees TO service_role;

ALTER TABLE public.memory_invitees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Book owner reads invitees" ON public.memory_invitees;
CREATE POLICY "Book owner reads invitees" ON public.memory_invitees
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = memory_invitees.book_id AND b.user_id = auth.uid()));

DROP POLICY IF EXISTS "Book owner inserts invitees" ON public.memory_invitees;
CREATE POLICY "Book owner inserts invitees" ON public.memory_invitees
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.books b WHERE b.id = memory_invitees.book_id AND b.user_id = auth.uid()));

DROP POLICY IF EXISTS "Book owner updates invitees" ON public.memory_invitees;
CREATE POLICY "Book owner updates invitees" ON public.memory_invitees
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = memory_invitees.book_id AND b.user_id = auth.uid()));

DROP POLICY IF EXISTS "Book owner deletes invitees" ON public.memory_invitees;
CREATE POLICY "Book owner deletes invitees" ON public.memory_invitees
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = memory_invitees.book_id AND b.user_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_memory_invitees_updated_at ON public.memory_invitees;
CREATE TRIGGER trg_memory_invitees_updated_at
  BEFORE UPDATE ON public.memory_invitees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. submit_family_contributions RPC
CREATE OR REPLACE FUNCTION public.submit_family_contributions(
  _token TEXT,
  _from_name TEXT,
  _from_email TEXT,
  _entries JSONB
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_id UUID;
  v_entry JSONB;
  v_text TEXT;
  v_type TEXT;
  v_size TEXT;
  v_sentences INT;
  v_count INT := 0;
BEGIN
  SELECT book_id INTO v_book_id
    FROM public.memory_invites
    WHERE token = _token AND revoked_at IS NULL
    LIMIT 1;

  IF v_book_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or revoked invite';
  END IF;

  IF length(trim(coalesce(_from_name,''))) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  IF _entries IS NULL OR jsonb_array_length(_entries) = 0 THEN
    RAISE EXCEPTION 'At least one entry is required';
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(_entries)
  LOOP
    v_text := trim(coalesce(v_entry->>'text',''));
    v_type := coalesce(v_entry->>'type','memory');

    IF v_type NOT IN ('memory','wisdom') THEN
      v_type := 'memory';
    END IF;

    IF length(v_text) = 0 THEN
      CONTINUE;
    END IF;

    IF length(v_text) > 5000 THEN
      RAISE EXCEPTION 'Entry too long';
    END IF;

    v_sentences := array_length(regexp_split_to_array(v_text, '[.!?]+\s'), 1);
    v_size := CASE
      WHEN v_sentences <= 1 THEN 'small'
      WHEN v_sentences <= 3 THEN 'medium'
      ELSE 'full'
    END;

    INSERT INTO public.memories (
      book_id, contributor_name, contributor_email, contributor_type,
      memory_text, size_tag, status, entry_type
    ) VALUES (
      v_book_id,
      trim(_from_name),
      NULLIF(trim(coalesce(_from_email,'')), ''),
      'family',
      v_text,
      v_size,
      'pending_approval',
      v_type
    );

    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'At least one non-empty entry is required';
  END IF;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_family_contributions(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- 4. Realtime
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'memories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;
  END IF;
END $$;

ALTER TABLE public.memories REPLICA IDENTITY FULL;
