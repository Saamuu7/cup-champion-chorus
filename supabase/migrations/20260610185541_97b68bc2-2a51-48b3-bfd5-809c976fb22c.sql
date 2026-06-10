
REVOKE EXECUTE ON FUNCTION public._progress_round(text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_standings() FROM PUBLIC, anon;
-- compute_standings is STABLE/SQL with no SECURITY DEFINER, already invoker; keep grant for authenticated reads
GRANT EXECUTE ON FUNCTION public.compute_standings() TO authenticated;
