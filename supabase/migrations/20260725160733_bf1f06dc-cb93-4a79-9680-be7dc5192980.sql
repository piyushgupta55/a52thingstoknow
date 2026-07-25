
CREATE OR REPLACE FUNCTION public.admin_grant_comp_by_email(_email text, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF _books_comped = 0 THEN
    INSERT INTO public.pending_comps (email, reason, granted_by)
    VALUES (lower(_email), _reason, _uid)
    ON CONFLICT (lower(email)) WHERE redeemed_at IS NULL DO UPDATE
      SET reason = EXCLUDED.reason, granted_by = EXCLUDED.granted_by, created_at = now();
    RETURN jsonb_build_object('kind', 'pending_existing_user', 'user_id', _target, 'email', lower(_email));
  END IF;

  RETURN jsonb_build_object('kind', 'granted', 'user_id', _target, 'books', _books_comped);
END;
$function$;
