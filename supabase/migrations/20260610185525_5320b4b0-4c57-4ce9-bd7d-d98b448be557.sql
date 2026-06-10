
-- Standings view function (per group rank)
CREATE OR REPLACE FUNCTION public.compute_standings()
RETURNS TABLE(team text, flag text, grp text, rk int, pts int, gd int, gf int)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH played AS (
    SELECT home_team AS t, home_flag AS f, group_name AS g,
           home_score AS sf, away_score AS sa,
           CASE WHEN home_score > away_score THEN 3
                WHEN home_score = away_score THEN 1 ELSE 0 END AS p
    FROM public.matches
    WHERE stage = 'group' AND home_score IS NOT NULL AND away_score IS NOT NULL
    UNION ALL
    SELECT away_team, away_flag, group_name, away_score, home_score,
           CASE WHEN away_score > home_score THEN 3
                WHEN away_score = home_score THEN 1 ELSE 0 END
    FROM public.matches
    WHERE stage = 'group' AND home_score IS NOT NULL AND away_score IS NOT NULL
  ),
  agg AS (
    SELECT t AS team, max(f) AS flag, max(g) AS grp,
           sum(p)::int AS pts, sum(sf - sa)::int AS gd, sum(sf)::int AS gf
    FROM played GROUP BY t
  )
  SELECT team, flag, grp,
         row_number() OVER (PARTITION BY grp ORDER BY pts DESC, gd DESC, gf DESC)::int AS rk,
         pts, gd, gf
  FROM agg;
$$;

GRANT EXECUTE ON FUNCTION public.compute_standings() TO authenticated;

-- Progress generic helper: pair winners of a completed round into the next
CREATE OR REPLACE FUNCTION public._progress_round(p_from text, p_to text, p_count int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_done int;
  v_last timestamptz;
  v_teams text[] := ARRAY[]::text[];
  v_flags text[] := ARRAY[]::text[];
  rec record;
  i int;
BEGIN
  -- Skip if next round already generated
  IF EXISTS (SELECT 1 FROM public.matches WHERE stage = p_to) THEN RETURN; END IF;

  SELECT count(*) INTO v_done
  FROM public.matches
  WHERE stage = p_from
    AND home_score IS NOT NULL AND away_score IS NOT NULL
    AND home_score <> away_score;

  IF v_done < p_count THEN RETURN; END IF;

  SELECT coalesce(max(match_date), now()) INTO v_last FROM public.matches WHERE stage = p_from;

  FOR rec IN
    SELECT CASE WHEN home_score > away_score THEN home_team ELSE away_team END AS team,
           CASE WHEN home_score > away_score THEN home_flag ELSE away_flag END AS flag
    FROM public.matches
    WHERE stage = p_from
    ORDER BY match_date, id
  LOOP
    v_teams := array_append(v_teams, rec.team);
    v_flags := array_append(v_flags, rec.flag);
  END LOOP;

  i := 1;
  WHILE i < array_length(v_teams, 1) LOOP
    INSERT INTO public.matches(home_team, home_flag, away_team, away_flag, match_date, stage)
    VALUES (v_teams[i], v_flags[i], v_teams[i+1], v_flags[i+1],
            v_last + ((i + 1) / 2 || ' days')::interval, p_to);
    i := i + 2;
  END LOOP;
END;
$$;

-- Main entry point
CREATE OR REPLACE FUNCTION public.generate_knockouts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total int;
  v_done int;
  v_last timestamptz;
  v_teams text[] := ARRAY[]::text[];
  v_flags text[] := ARRAY[]::text[];
  i int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE home_score IS NOT NULL AND away_score IS NOT NULL)
    INTO v_total, v_done
  FROM public.matches WHERE stage = 'group';

  IF v_total = 0 OR v_done < v_total THEN
    -- Even if group not done, still try to progress further (safe no-ops)
    PERFORM public._progress_round('r32','r16',16);
    PERFORM public._progress_round('r16','qf',8);
    PERFORM public._progress_round('qf','sf',4);
    PERFORM public._progress_round('sf','final',2);
    RETURN;
  END IF;

  -- Generate Round of 32 if not yet present
  IF NOT EXISTS (SELECT 1 FROM public.matches WHERE stage = 'r32') THEN
    SELECT coalesce(max(match_date), now()) INTO v_last FROM public.matches WHERE stage = 'group';

    WITH s AS (SELECT * FROM public.compute_standings()),
    top2 AS (SELECT team, flag, pts, gd, gf FROM s WHERE rk <= 2),
    thirds AS (
      SELECT team, flag, pts, gd, gf FROM s WHERE rk = 3
      ORDER BY pts DESC, gd DESC, gf DESC LIMIT 8
    ),
    qualified AS (
      SELECT team, flag,
             row_number() OVER (ORDER BY pts DESC, gd DESC, gf DESC) AS seed
      FROM (SELECT * FROM top2 UNION ALL SELECT * FROM thirds) u
    )
    SELECT array_agg(team ORDER BY seed), array_agg(flag ORDER BY seed)
      INTO v_teams, v_flags FROM qualified;

    IF v_teams IS NOT NULL AND array_length(v_teams, 1) = 32 THEN
      FOR i IN 1..16 LOOP
        INSERT INTO public.matches(home_team, home_flag, away_team, away_flag, match_date, stage)
        VALUES (v_teams[i], v_flags[i], v_teams[33 - i], v_flags[33 - i],
                v_last + (i || ' days')::interval, 'r32');
      END LOOP;
    END IF;
  END IF;

  PERFORM public._progress_round('r32','r16',16);
  PERFORM public._progress_round('r16','qf',8);
  PERFORM public._progress_round('qf','sf',4);
  PERFORM public._progress_round('sf','final',2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_knockouts() TO authenticated;
