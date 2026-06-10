
-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  language TEXT NOT NULL DEFAULT 'es',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PORRAS
CREATE TABLE public.porras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.porras TO authenticated;
GRANT ALL ON public.porras TO service_role;
ALTER TABLE public.porras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "porras select authenticated" ON public.porras FOR SELECT TO authenticated USING (true);
CREATE POLICY "porras insert own" ON public.porras FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- PORRA MEMBERS
CREATE TABLE public.porra_members (
  porra_id UUID NOT NULL REFERENCES public.porras(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (porra_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.porra_members TO authenticated;
GRANT ALL ON public.porra_members TO service_role;
ALTER TABLE public.porra_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members select authenticated" ON public.porra_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members insert self" ON public.porra_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members delete self" ON public.porra_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MATCHES
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_date TIMESTAMPTZ NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_flag TEXT NOT NULL,
  away_flag TEXT NOT NULL,
  group_name TEXT,
  stage TEXT NOT NULL DEFAULT 'group',
  home_score INTEGER,
  away_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches select authenticated" ON public.matches FOR SELECT TO authenticated USING (true);

-- PREDICTIONS
CREATE TABLE public.predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  porra_id UUID NOT NULL REFERENCES public.porras(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (porra_id, user_id, match_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions select members" ON public.predictions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.porra_members m WHERE m.porra_id = predictions.porra_id AND m.user_id = auth.uid()));
CREATE POLICY "predictions insert self" ON public.predictions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.porra_members m WHERE m.porra_id = predictions.porra_id AND m.user_id = auth.uid()));
CREATE POLICY "predictions update self" ON public.predictions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed matches (FIFA World Cup 2026 group stage subset)
INSERT INTO public.matches (match_date, home_team, away_team, home_flag, away_flag, group_name) VALUES
('2026-06-11 20:00+00','México','EE.UU.','🇲🇽','🇺🇸','A'),
('2026-06-12 18:00+00','Canadá','Ecuador','🇨🇦','🇪🇨','B'),
('2026-06-12 21:00+00','España','Marruecos','🇪🇸','🇲🇦','C'),
('2026-06-13 16:00+00','Argentina','Arabia Saudí','🇦🇷','🇸🇦','D'),
('2026-06-13 19:00+00','Francia','Senegal','🇫🇷','🇸🇳','E'),
('2026-06-13 22:00+00','Brasil','Japón','🇧🇷','🇯🇵','F'),
('2026-06-14 16:00+00','Inglaterra','Egipto','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇪🇬','G'),
('2026-06-14 19:00+00','Alemania','Corea del Sur','🇩🇪','🇰🇷','H'),
('2026-06-14 22:00+00','Portugal','Croacia','🇵🇹','🇭🇷','I'),
('2026-06-15 18:00+00','Países Bajos','Australia','🇳🇱','🇦🇺','J'),
('2026-06-15 21:00+00','Bélgica','Colombia','🇧🇪','🇨🇴','K'),
('2026-06-16 18:00+00','Italia','Uruguay','🇮🇹','🇺🇾','L'),
('2026-06-17 18:00+00','México','Ecuador','🇲🇽','🇪🇨','A'),
('2026-06-17 21:00+00','EE.UU.','Canadá','🇺🇸','🇨🇦','B'),
('2026-06-18 18:00+00','España','Argentina','🇪🇸','🇦🇷','C'),
('2026-06-18 21:00+00','Marruecos','Arabia Saudí','🇲🇦','🇸🇦','D'),
('2026-06-19 18:00+00','Francia','Brasil','🇫🇷','🇧🇷','E'),
('2026-06-19 21:00+00','Senegal','Japón','🇸🇳','🇯🇵','F'),
('2026-06-20 18:00+00','Inglaterra','Alemania','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇩🇪','G'),
('2026-06-20 21:00+00','Egipto','Corea del Sur','🇪🇬','🇰🇷','H'),
('2026-06-21 18:00+00','Portugal','Países Bajos','🇵🇹','🇳🇱','I'),
('2026-06-21 21:00+00','Croacia','Australia','🇭🇷','🇦🇺','J'),
('2026-06-22 18:00+00','Bélgica','Italia','🇧🇪','🇮🇹','K'),
('2026-06-22 21:00+00','Colombia','Uruguay','🇨🇴','🇺🇾','L'),
('2026-06-24 20:00+00','EE.UU.','Ecuador','🇺🇸','🇪🇨','A'),
('2026-06-24 20:00+00','México','Canadá','🇲🇽','🇨🇦','B'),
('2026-06-25 20:00+00','Argentina','Marruecos','🇦🇷','🇲🇦','C'),
('2026-06-25 20:00+00','España','Arabia Saudí','🇪🇸','🇸🇦','D'),
('2026-06-26 20:00+00','Brasil','Senegal','🇧🇷','🇸🇳','E'),
('2026-06-26 20:00+00','Francia','Japón','🇫🇷','🇯🇵','F'),
('2026-06-27 20:00+00','Alemania','Egipto','🇩🇪','🇪🇬','G'),
('2026-06-27 20:00+00','Inglaterra','Corea del Sur','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇰🇷','H'),
('2026-06-28 20:00+00','Croacia','Países Bajos','🇭🇷','🇳🇱','I'),
('2026-06-28 20:00+00','Portugal','Australia','🇵🇹','🇦🇺','J'),
('2026-06-29 20:00+00','Italia','Colombia','🇮🇹','🇨🇴','K'),
('2026-06-29 20:00+00','Bélgica','Uruguay','🇧🇪','🇺🇾','L');
