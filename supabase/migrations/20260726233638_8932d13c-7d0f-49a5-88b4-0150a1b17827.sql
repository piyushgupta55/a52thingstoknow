CREATE OR REPLACE FUNCTION public.redeem_pending_comp_on_book()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _pending record;
  _deadline date;
BEGIN
  SELECT lower(email) INTO _email FROM auth.users WHERE id = NEW.user_id;
  IF _email IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.book_purchases
    WHERE book_id = NEW.id AND status = 'active'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _pending
  FROM public.pending_comps
  WHERE lower(email) = _email
    AND (
      redeemed_at IS NULL
      OR (redeemed_at IS NOT NULL AND redeemed_book_id IS NULL)
      OR redeemed_book_id = NEW.id
    )
  ORDER BY
    CASE WHEN redeemed_at IS NULL THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1;

  IF _pending.id IS NULL THEN
    RETURN NEW;
  END IF;

  _deadline := (now() + interval '365 days')::date;

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
$function$;

DROP TRIGGER IF EXISTS redeem_pending_comp_on_book_created ON public.books;
CREATE TRIGGER redeem_pending_comp_on_book_created
AFTER INSERT ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.redeem_pending_comp_on_book();

CREATE OR REPLACE FUNCTION public.claim_pending_comp(_book_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid;
  _email text;
  _owner uuid;
  _pending record;
  _deadline date;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_authenticated');
  END IF;

  SELECT user_id INTO _owner FROM public.books WHERE id = _book_id;
  IF _owner IS NULL OR _owner <> _uid THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_owner');
  END IF;

  IF EXISTS (SELECT 1 FROM public.book_purchases WHERE book_id = _book_id AND status = 'active') THEN
    RETURN jsonb_build_object('claimed', true, 'reason', 'already_unlocked');
  END IF;

  SELECT lower(email) INTO _email FROM auth.users WHERE id = _uid;
  IF _email IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_email');
  END IF;

  SELECT * INTO _pending FROM public.pending_comps
   WHERE lower(email) = _email
     AND (
       redeemed_at IS NULL
       OR (redeemed_at IS NOT NULL AND redeemed_book_id IS NULL)
       OR redeemed_book_id = _book_id
     )
   ORDER BY
     CASE WHEN redeemed_at IS NULL THEN 0 ELSE 1 END,
     created_at DESC
   LIMIT 1;

  IF _pending.id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_pending_comp');
  END IF;

  _deadline := (now() + interval '365 days')::date;

  INSERT INTO public.book_purchases (
    book_id, user_id, amount_paid_cents, currency, status, environment,
    guarantee_deadline, is_comp, comp_reason, comp_granted_by
  ) VALUES (
    _book_id, _uid, 0, 'usd', 'active', 'comp',
    _deadline, true, _pending.reason, _pending.granted_by
  );

  UPDATE public.pending_comps
     SET redeemed_at = now(), redeemed_book_id = _book_id
   WHERE id = _pending.id;

  RETURN jsonb_build_object('claimed', true, 'reason', 'comped');
END;
$function$;