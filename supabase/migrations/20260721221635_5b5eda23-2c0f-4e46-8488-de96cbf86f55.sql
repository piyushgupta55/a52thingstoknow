
ALTER TABLE public.book_purchases
  ADD COLUMN IF NOT EXISTS is_comp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comp_reason text,
  ADD COLUMN IF NOT EXISTS comp_granted_by uuid;

CREATE TABLE IF NOT EXISTS public.pending_comps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  reason text,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  redeemed_book_id uuid REFERENCES public.books(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS pending_comps_email_open_uniq
  ON public.pending_comps (lower(email)) WHERE redeemed_at IS NULL;

GRANT SELECT ON public.pending_comps TO authenticated;
GRANT ALL ON public.pending_comps TO service_role;
ALTER TABLE public.pending_comps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view pending comps" ON public.pending_comps
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert pending comps" ON public.pending_comps
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update pending comps" ON public.pending_comps
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete pending comps" ON public.pending_comps
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin grant on a specific existing book
CREATE OR REPLACE FUNCTION public.admin_grant_book_comp(_book_id uuid, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _owner uuid;
  _existing uuid;
  _deadline timestamptz;
  _new_id uuid;
BEGIN
  _uid := auth.uid();
  IF NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT user_id INTO _owner FROM public.books WHERE id = _book_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'book not found';
  END IF;

  -- Reactivate an existing comp if present
  SELECT id INTO _existing FROM public.book_purchases
    WHERE book_id = _book_id AND is_comp = true
    ORDER BY created_at DESC LIMIT 1;
  IF _existing IS NOT NULL THEN
    UPDATE public.book_purchases
       SET status = 'active',
           comp_reason = COALESCE(_reason, comp_reason),
           comp_granted_by = _uid,
           updated_at = now()
     WHERE id = _existing;
    RETURN _existing;
  END IF;

  _deadline := now() + interval '365 days';

  INSERT INTO public.book_purchases (
    book_id, user_id, amount_paid_cents, currency, status, environment,
    guarantee_deadline, is_comp, comp_reason, comp_granted_by
  ) VALUES (
    _book_id, _owner, 0, 'usd', 'active', 'comp',
    _deadline, true, _reason, _uid
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_book_comp(_book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.book_purchases
     SET status = 'revoked', updated_at = now()
   WHERE book_id = _book_id AND is_comp = true AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_comp_by_email(_email text, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _target uuid;
  _books_comped int := 0;
  _book record;
BEGIN
  _uid := auth.uid();
  IF NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id INTO _target FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;

  IF _target IS NULL THEN
    INSERT INTO public.pending_comps (email, reason, granted_by)
    VALUES (lower(_email), _reason, _uid)
    ON CONFLICT (lower(email)) WHERE redeemed_at IS NULL DO UPDATE
      SET reason = EXCLUDED.reason, granted_by = EXCLUDED.granted_by, created_at = now();
    RETURN jsonb_build_object('kind', 'pending', 'email', lower(_email));
  END IF;

  FOR _book IN SELECT id FROM public.books WHERE user_id = _target LOOP
    PERFORM public.admin_grant_book_comp(_book.id, _reason);
    _books_comped := _books_comped + 1;
  END LOOP;

  RETURN jsonb_build_object('kind', 'granted', 'user_id', _target, 'books', _books_comped);
END;
$$;

-- Trigger: when a book is created, redeem any pending comp for that user's email
CREATE OR REPLACE FUNCTION public.redeem_pending_comp_on_book()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _pending record;
  _deadline timestamptz;
BEGIN
  SELECT lower(email) INTO _email FROM auth.users WHERE id = NEW.user_id;
  IF _email IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _pending FROM public.pending_comps
    WHERE lower(email) = _email AND redeemed_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF _pending.id IS NULL THEN RETURN NEW; END IF;

  _deadline := now() + interval '365 days';
  INSERT INTO public.book_purchases (
    book_id, user_id, amount_paid_cents, currency, status, environment,
    guarantee_deadline, is_comp, comp_reason, comp_granted_by
  ) VALUES (
    NEW.id, NEW.user_id, 0, 'usd', 'active', 'comp',
    _deadline, true, _pending.reason, _pending.granted_by
  );

  UPDATE public.pending_comps
     SET redeemed_at = now(), redeemed_book_id = NEW.id
   WHERE id = _pending.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_redeem_pending_comp ON public.books;
CREATE TRIGGER trg_redeem_pending_comp
AFTER INSERT ON public.books
FOR EACH ROW EXECUTE FUNCTION public.redeem_pending_comp_on_book();
