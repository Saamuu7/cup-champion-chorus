-- Update prediction lock to 1 minute before the match starts
CREATE OR REPLACE FUNCTION public.check_match_not_started()
RETURNS TRIGGER AS $$
DECLARE
  v_match_date timestamptz;
  v_match_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_match_id := OLD.match_id;
  ELSE
    v_match_id := NEW.match_id;
  END IF;

  SELECT match_date INTO v_match_date
  FROM public.matches
  WHERE id = v_match_id;

  IF v_match_date IS NOT NULL AND v_match_date - INTERVAL '1 minute' <= now() THEN
    RAISE EXCEPTION 'Falta menos de un minuto para el partido, la porra está cerrada.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
