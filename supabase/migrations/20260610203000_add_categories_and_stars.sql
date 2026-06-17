-- Add category and has_star columns, populate categories, and add unique star trigger limit
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS has_star BOOLEAN NOT NULL DEFAULT false;

DELETE FROM public.matches;

INSERT INTO public.matches (match_date, home_team, away_team, home_flag, away_flag, group_name, category) VALUES
('2026-06-11 21:00+02', 'México', 'Sudáfrica', '🇲🇽', '🇿🇦', 'A', 'J1'),
('2026-06-12 04:00+02', 'Corea del Sur', 'República Checa', '🇰🇷', '🇨🇿', 'A', 'J1'),
('2026-06-12 21:00+02', 'Canadá', 'Bosnia y Herzegovina', '🇨🇦', '🇧🇦', 'B', 'J1'),
('2026-06-13 00:00+02', 'Brasil', 'Marruecos', '🇧🇷', '🇲🇦', 'C', 'J1'),
('2026-06-13 03:00+02', 'Estados Unidos', 'Paraguay', '🇺🇸', '🇵🇾', 'D', 'J1'),
('2026-06-13 21:00+02', 'Catar', 'Suiza', '🇶🇦', '🇨🇭', 'B', 'J1'),
('2026-06-14 18:00+02', 'Haití', 'Escocia', '🇭🇹', '🏴‍󠁢󠁳󠁣󠁴󠁿', 'C', 'J1'),
('2026-06-14 19:00+02', 'Alemania', 'Curazao', '🇩🇪', '🇨🇼', 'E', 'J1'),
('2026-06-14 21:00+02', 'Australia', 'Turquía', '🇦🇺', '🇹🇷', 'D', 'J1'),
('2026-06-14 22:00+02', 'Costa de Marfil', 'Ecuador', '🇨🇮', '🇪🇨', 'E', 'J1'),
('2026-06-14 22:00+02', 'Países Bajos', 'Japón', '🇳🇱', '🇯🇵', 'F', 'J1'),
('2026-06-15 18:00+02', 'España', 'Cabo Verde', '🇪🇸', '🇨🇻', 'H', 'J1'),
('2026-06-15 19:00+02', 'Suecia', 'Túnez', '🇸🇪', '🇹🇳', 'F', 'J1'),
('2026-06-15 21:00+02', 'Bélgica', 'Egipto', '🇧🇪', '🇪🇬', 'G', 'J1'),
('2026-06-16 18:00+02', 'Irán', 'Nueva Zelanda', '🇮🇷', '🇳🇿', 'G', 'J1'),
('2026-06-16 21:00+02', 'Arabia Saudita', 'Uruguay', '🇸🇦', '🇺🇾', 'H', 'J1'),
('2026-06-16 21:00+02', 'Francia', 'Senegal', '🇫🇷', '🇸🇳', 'I', 'J1'),
('2026-06-17 03:00+02', 'Argentina', 'Algeria', '🇦🇷', '🇩🇿', 'J', 'J1'),
('2026-06-17 18:00+02', 'Irak', 'Noruega', '🇮🇶', '🇳🇴', 'I', 'J1'),
('2026-06-17 19:00+02', 'Portugal', 'RD del Congo', '🇵🇹', '🇨🇩', 'K', 'J1'),
('2026-06-17 19:00+02', 'Ghana', 'Panamá', '🇬🇭', '🇵🇦', 'L', 'J1'),
('2026-06-17 21:00+02', 'Austria', 'Jordania', '🇦🇹', '🇯🇴', 'J', 'J1'),
('2026-06-17 22:00+02', 'Inglaterra', 'Croacia', '🏴‍󠁢󠁥󠁮󠁧󠁿', '🇭🇷', 'L', 'J1'),
('2026-06-18 18:00+02', 'República Checa', 'Sudáfrica', '🇨🇿', '🇿🇦', 'A', 'J2'),
('2026-06-18 21:00+02', 'Bosnia y Herzegovina', 'Suiza', '🇧🇦', '🇨🇭', 'B', 'J2'),
('2026-06-18 22:00+02', 'Uzbekistán', 'Colombia', '🇺🇿', '🇨🇴', 'K', 'J1'),
('2026-06-19 00:00+02', 'Canadá', 'Catar', '🇨🇦', '🇶🇦', 'B', 'J2'),
('2026-06-19 03:00+02', 'México', 'Corea del Sur', '🇲🇽', '🇰🇷', 'A', 'J2'),
('2026-06-19 22:00+02', 'Estados Unidos', 'Australia', '🇺🇸', '🇦🇺', 'D', 'J2'),
('2026-06-20 02:30+02', 'Haití', 'Brasil', '🇭🇹', '🇧🇷', 'C', 'J2'),
('2026-06-20 18:00+02', 'Paraguay', 'Turquía', '🇵🇾', '🇹🇷', 'D', 'J2'),
('2026-06-20 19:00+02', 'Alemania', 'Costa de Marfil', '🇩🇪', '🇨🇮', 'E', 'J2'),
('2026-06-20 21:00+02', 'Marruecos', 'Escocia', '🇲🇦', '🏴‍󠁢󠁳󠁣󠁴󠁿', 'C', 'J2'),
('2026-06-20 22:00+02', 'Países Bajos', 'Suecia', '🇳🇱', '🇸🇪', 'F', 'J2'),
('2026-06-21 18:00+02', 'Curazao', 'Ecuador', '🇨🇼', '🇪🇨', 'E', 'J2'),
('2026-06-21 18:00+02', 'España', 'Arabia Saudita', '🇪🇸', '🇸🇦', 'H', 'J2'),
('2026-06-21 21:00+02', 'Japón', 'Túnez', '🇯🇵', '🇹🇳', 'F', 'J2'),
('2026-06-21 21:00+02', 'Bélgica', 'Irán', '🇧🇪', '🇮🇷', 'G', 'J2'),
('2026-06-22 18:00+02', 'Algeria', 'Jordania', '🇩🇿', '🇯🇴', 'J', 'J2'),
('2026-06-22 19:00+02', 'Francia', 'Irak', '🇫🇷', '🇮🇶', 'I', 'J2'),
('2026-06-22 21:00+02', 'Cabo Verde', 'Uruguay', '🇨🇻', '🇺🇾', 'H', 'J2'),
('2026-06-22 21:00+02', 'Argentina', 'Austria', '🇦🇷', '🇦🇹', 'J', 'J2'),
('2026-06-22 22:00+02', 'Egipto', 'Nueva Zelanda', '🇪🇬', '🇳🇿', 'G', 'J2'),
('2026-06-22 22:00+02', 'Senegal', 'Noruega', '🇸🇳', '🇳🇴', 'I', 'J2'),
('2026-06-23 18:00+02', 'RD del Congo', 'Colombia', '🇨🇩', '🇨🇴', 'K', 'J2'),
('2026-06-23 19:00+02', 'Inglaterra', 'Ghana', '🏴‍󠁢󠁥󠁮󠁧󠁿', '🇬🇭', 'L', 'J2'),
('2026-06-23 21:00+02', 'Portugal', 'Uzbekistán', '🇵🇹', '🇺🇿', 'K', 'J2'),
('2026-06-23 22:00+02', 'Croacia', 'Panamá', '🇭🇷', '🇵🇦', 'L', 'J2'),
('2026-06-24 21:00+02', 'Suiza', 'Canadá', '🇨🇭', '🇨🇦', 'B', 'J3'),
('2026-06-24 21:00+02', 'Bosnia y Herzegovina', 'Catar', '🇧🇦', '🇶🇦', 'B', 'J3'),
('2026-06-24 22:00+02', 'Escocia', 'Brasil', '🏴‍󠁢󠁳󠁣󠁴󠁿', '🇧🇷', 'C', 'J3'),
('2026-06-24 22:00+02', 'Marruecos', 'Haití', '🇲🇦', '🇭🇹', 'C', 'J3'),
('2026-06-25 21:00+02', 'Ecuador', 'Alemania', '🇪🇨', '🇩🇪', 'E', 'J3'),
('2026-06-25 21:00+02', 'Curazao', 'Costa de Marfil', '🇨🇼', '🇨🇮', 'E', 'J3'),
('2026-06-25 21:00+02', 'Túnez', 'Países Bajos', '🇹🇳', '🇳🇱', 'F', 'J3'),
('2026-06-25 21:00+02', 'Japón', 'Suecia', '🇯🇵', '🇸🇪', 'F', 'J3'),
('2026-06-25 22:00+02', 'República Checa', 'México', '🇨🇿', '🇲🇽', 'A', 'J3'),
('2026-06-25 22:00+02', 'Sudáfrica', 'Corea del Sur', '🇿🇦', '🇰🇷', 'A', 'J3'),
('2026-06-25 23:00+02', 'Turquía', 'Estados Unidos', '🇹🇷', '🇺🇸', 'D', 'J3'),
('2026-06-25 23:00+02', 'Paraguay', 'Australia', '🇵🇾', '🇦🇺', 'D', 'J3'),
('2026-06-26 21:00+02', 'Noruega', 'Francia', '🇳🇴', '🇫🇷', 'I', 'J3'),
('2026-06-26 21:00+02', 'Senegal', 'Irak', '🇸🇳', '🇮🇶', 'I', 'J3'),
('2026-06-26 22:00+02', 'Nueva Zelanda', 'Bélgica', '🇳🇿', '🇧🇪', 'G', 'J3'),
('2026-06-26 22:00+02', 'Egipto', 'Irán', '🇪🇬', '🇮🇷', 'G', 'J3'),
('2026-06-26 23:00+02', 'Jordania', 'Argentina', '🇯🇴', '🇦🇷', 'J', 'J3'),
('2026-06-26 23:00+02', 'Algeria', 'Austria', '🇩🇿', '🇦🇹', 'J', 'J3'),
('2026-06-27 02:00+02', 'Uruguay', 'España', '🇺🇾', '🇪🇸', 'H', 'J3'),
('2026-06-27 02:00+02', 'Cabo Verde', 'Arabia Saudita', '🇨🇻', '🇸🇦', 'H', 'J3'),
('2026-06-27 21:00+02', 'Panamá', 'Inglaterra', '🇵🇦', '🏴‍󠁢󠁥󠁮󠁧󠁿', 'L', 'J3'),
('2026-06-27 21:00+02', 'Croacia', 'Ghana', '🇭🇷', '🇬🇭', 'L', 'J3'),
('2026-06-27 22:00+02', 'Colombia', 'Portugal', '🇨🇴', '🇵🇹', 'K', 'J3'),
('2026-06-27 22:00+02', 'RD del Congo', 'Uzbekistán', '🇨🇩', '🇺🇿', 'K', 'J3');

-- Create trigger to ensure only one star prediction per user per category (jornada/stage)
CREATE OR REPLACE FUNCTION public.check_prediction_star_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_category TEXT;
  v_star_count INT;
BEGIN
  IF NEW.has_star = true THEN
    SELECT category INTO v_category FROM public.matches WHERE id = NEW.match_id;
    
    SELECT COUNT(*) INTO v_star_count
    FROM public.predictions p
    JOIN public.matches m ON p.match_id = m.id
    WHERE p.porra_id = NEW.porra_id
      AND p.user_id = NEW.user_id
      AND m.category = v_category
      AND p.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND p.has_star = true;
      
    IF v_star_count >= 1 THEN
      RAISE EXCEPTION 'Solo puedes marcar un partido con estrella (x2) por jornada/fase.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_check_prediction_star_limit
  BEFORE INSERT OR UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_prediction_star_limit();
