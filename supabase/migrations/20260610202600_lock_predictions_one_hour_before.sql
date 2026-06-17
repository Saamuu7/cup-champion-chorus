-- Update prediction lock to 1 hour before the match starts
CREATE OR REPLACE FUNCTION public.check_match_not_started()
RETURNS TRIGGER AS $$
DECLARE
  v_match_date timestamptz;
BEGIN
  SELECT match_date INTO v_match_date
  FROM public.matches
  WHERE id = NEW.match_id;

  IF v_match_date IS NOT NULL AND v_match_date - INTERVAL '1 hour' <= now() THEN
    RAISE EXCEPTION 'Falta menos de una hora para el partido, la porra está cerrada.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
