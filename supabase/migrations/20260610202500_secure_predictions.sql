-- Secure predictions: block inserts or updates once the match starts
CREATE OR REPLACE FUNCTION public.check_match_not_started()
RETURNS TRIGGER AS $$
DECLARE
  v_match_date timestamptz;
BEGIN
  SELECT match_date INTO v_match_date
  FROM public.matches
  WHERE id = NEW.match_id;

  IF v_match_date IS NOT NULL AND v_match_date <= now() THEN
    RAISE EXCEPTION 'El partido ya ha comenzado y la porra está cerrada.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_check_match_not_started
  BEFORE INSERT OR UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_match_not_started();
