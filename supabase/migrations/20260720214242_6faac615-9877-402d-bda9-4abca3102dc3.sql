
-- Book purchases (per-book unlocks)
CREATE TABLE public.book_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  amount_paid_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  discount_code text,
  extra_copies integer NOT NULL DEFAULT 0,
  shipping_address jsonb,
  target_date date,
  guarantee_deadline date NOT NULL,
  status text NOT NULL DEFAULT 'active', -- active | refunded | pending
  refund_reason text,
  refund_reason_text text,
  refunded_at timestamptz,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_book_purchases_user ON public.book_purchases(user_id);
CREATE INDEX idx_book_purchases_book ON public.book_purchases(book_id);
CREATE INDEX idx_book_purchases_active ON public.book_purchases(book_id) WHERE status = 'active';

GRANT SELECT ON public.book_purchases TO authenticated;
GRANT ALL ON public.book_purchases TO service_role;

ALTER TABLE public.book_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own purchases"
  ON public.book_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all purchases"
  ON public.book_purchases FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER book_purchases_set_updated_at
  BEFORE UPDATE ON public.book_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: is a book unlocked?
CREATE OR REPLACE FUNCTION public.book_is_unlocked(_book_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.book_purchases
    WHERE book_id = _book_id AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.book_is_unlocked(uuid) TO authenticated, anon;
