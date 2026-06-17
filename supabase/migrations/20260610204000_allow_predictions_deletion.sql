-- Allow authenticated users to delete their own predictions, and enforce 1 hour lock trigger on delete
CREATE POLICY "predictions delete self" ON public.predictions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

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

  IF v_match_date IS NOT NULL AND v_match_date - INTERVAL '1 hour' <= now() THEN
    RAISE EXCEPTION 'Falta menos de una hora para el partido, la porra está cerrada.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_match_not_started ON public.predictions;

CREATE TRIGGER tr_check_match_not_started
  BEFORE INSERT OR UPDATE OR DELETE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_match_not_started();
