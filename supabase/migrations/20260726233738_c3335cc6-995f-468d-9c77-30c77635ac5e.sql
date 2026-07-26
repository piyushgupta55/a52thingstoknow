DROP TRIGGER IF EXISTS trg_redeem_pending_comp ON public.books;

REVOKE EXECUTE ON FUNCTION public.claim_pending_comp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_comp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_comp(uuid) TO service_role;