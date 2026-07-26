REVOKE EXECUTE ON FUNCTION public.claim_pending_comp(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_pending_comp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_comp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_comp(uuid) TO service_role;