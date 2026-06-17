import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivePorra } from "@/hooks/useActivePorra";
import { useAuth } from "@/hooks/useAuth";
import { calcPoints } from "@/lib/scoring";
import { Trophy, Medal } from "lucide-react";

export const Route = createFileRoute("/porra/ranking")({
  component: RankingTab,
});

interface Row {
  user_id: string;
  username: string;
  avatar_url: string | null;
  points: number;
  exactCount: number;
  winnerCount: number;
  hasPlenosBadge: boolean;
  hasStreakBadge: boolean;
}

function RankingTab() {
  const { porraId } = useActivePorra();
  const { user } = useAuth();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["ranking", porraId],
    enabled: !!porraId,
    queryFn: async (): Promise<Row[]> => {
      const [{ data: mems }, { data: preds }, { data: matches }] = await Promise.all([
        supabase.from("porra_members").select("user_id").eq("porra_id", porraId!),
        supabase
          .from("predictions")
          .select("user_id, match_id, home_score, away_score, has_star")
          .eq("porra_id", porraId!),
        supabase
          .from("matches")
          .select("id, match_date, home_score, away_score")
          .not("home_score", "is", null),
      ]);

      const ids = (mems ?? []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", ids);

      // Sort finished matches descending to find the 3 most recently played matches
      const finishedMatchesSorted = [...(matches ?? [])].sort(
        (a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime()
      );

      const matchById = new Map((matches ?? []).map((m) => [m.id, m]));
      const byUser = new Map<string, Row>();
      (profs ?? []).forEach((p) => {
        byUser.set(p.id, {
          user_id: p.id,
          username: p.username,
          avatar_url: p.avatar_url,
          points: 0,
          exactCount: 0,
          winnerCount: 0,
          hasPlenosBadge: false,
          hasStreakBadge: false,
        });
      });

      // Group predictions by user to calculate streaks easily
      const predsByUser = new Map<string, typeof preds>();
      (preds ?? []).forEach((p) => {
        if (!predsByUser.has(p.user_id)) {
          predsByUser.set(p.user_id, []);
        }
        predsByUser.get(p.user_id)!.push(p);
      });

      (preds ?? []).forEach((p) => {
        const m = matchById.get(p.match_id);
        if (!m) return;
        const rawPts = calcPoints(p.home_score, p.away_score, m.home_score, m.away_score);
        const pts = rawPts * (p.has_star ? 2 : 1);
        const row = byUser.get(p.user_id);
        if (!row) return;
        row.points += pts;
        if (rawPts === 5) row.exactCount++;
        else if (rawPts === 3) row.winnerCount++;
      });

      // Calculate badges for each user
      byUser.forEach((row, userId) => {
        // 1. Cazador de plenos: > 5 exact matches
        row.hasPlenosBadge = row.exactCount > 5;

        // 2. Racha de fuego: scored points in the last 3 finished matches in the tournament
        const userPreds = predsByUser.get(userId) ?? [];
        let hasStreak = false;
        if (finishedMatchesSorted.length >= 3) {
          const last3 = finishedMatchesSorted.slice(0, 3);
          let scoredAll3 = true;
          for (const m of last3) {
            const pred = userPreds.find((p) => p.match_id === m.id);
            if (!pred) {
              scoredAll3 = false;
              break;
            }
            const pts = calcPoints(pred.home_score, pred.away_score, m.home_score, m.away_score);
            if (pts <= 0) {
              scoredAll3 = false;
              break;
            }
          }
          hasStreak = scoredAll3;
        }
        row.hasStreakBadge = hasStreak;
      });

      return Array.from(byUser.values()).sort((a, b) => b.points - a.points);
    },
  });

  return (
    <div>
      <div
        className="relative bg-cover bg-center text-white pt-16 pb-20 px-4 flex flex-col items-center justify-center text-center overflow-hidden"
        style={{ backgroundImage: "url('/world-cup-bg.png')" }}
      >
        {/* Dark overlay to fade to black at the bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black pointer-events-none" />

        <div className="relative z-10 max-w-md w-full flex flex-col items-center">
          <span className="text-[#befc30] text-[10px] font-extrabold tracking-[0.4em] uppercase mb-1">
            CLASIFICACIÓN
          </span>
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md my-2">
            Ranking
          </h1>
          <p className="text-white/90 text-xs text-center max-w-xs drop-shadow-sm leading-relaxed px-4">
            Consulta los puntos y la clasificación general de los miembros de tu porra.
          </p>
        </div>
      </div>

      {/* Visual Podium for Top 3 */}
      {!isLoading && rows && rows.length >= 2 && (
        <div className="max-w-md mx-auto px-5 pt-8 pb-6 flex items-end justify-center gap-4 border-b border-neutral-900/40">
          
          {/* 2nd Place */}
          {rows[1] && (
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className="relative mb-2">
                <Avatar url={rows[1].avatar_url} name={rows[1].username} size="large" />
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-neutral-600 text-white font-black text-[9px] size-5 rounded-full flex items-center justify-center border border-neutral-800 shadow-md">2</span>
              </div>
              <span className="text-xs font-bold text-neutral-300 truncate w-full text-center">{rows[1].username}</span>
              <span className="text-[11px] font-extrabold text-[#befc30]">{rows[1].points} pts</span>
              <div className="w-full bg-neutral-900/50 border-t border-x border-neutral-850 rounded-t-xl h-11 mt-2 flex items-center justify-center text-neutral-400 font-extrabold text-sm shadow-md">
                🥈
              </div>
            </div>
          )}

          {/* 1st Place */}
          {rows[0] && (
            <div className="flex flex-col items-center flex-1 min-w-0 -translate-y-2">
              <div className="relative mb-2">
                <Avatar url={rows[0].avatar_url} name={rows[0].username} size="xl" />
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-black text-[10px] size-6 rounded-full flex items-center justify-center border-2 border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)] animate-bounce">1</span>
              </div>
              <span className="text-sm font-black text-white truncate w-full text-center">{rows[0].username}</span>
              <span className="text-xs font-black text-[#befc30]">{rows[0].points} pts</span>
              <div className="w-full bg-[#befc30]/10 border-t border-x border-[#befc30]/20 rounded-t-xl h-16 mt-2 flex items-center justify-center text-yellow-400 font-extrabold text-lg shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-[#befc30]/0 to-[#befc30]/5 group-hover:to-[#befc30]/10 transition-all" />
                🥇
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {rows[2] && (
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className="relative mb-2">
                <Avatar url={rows[2].avatar_url} name={rows[2].username} size="large" />
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-700 text-white font-black text-[9px] size-5 rounded-full flex items-center justify-center border border-neutral-800 shadow-md">3</span>
              </div>
              <span className="text-xs font-bold text-neutral-300 truncate w-full text-center">{rows[2].username}</span>
              <span className="text-[11px] font-extrabold text-[#befc30]">{rows[2].points} pts</span>
              <div className="w-full bg-neutral-900/50 border-t border-x border-neutral-850 rounded-t-xl h-8 mt-2 flex items-center justify-center text-amber-700 font-extrabold text-xs shadow-md">
                🥉
              </div>
            </div>
          )}

        </div>
      )}

      <div className="max-w-md mx-auto px-4 mt-4 pb-4 space-y-2">
        {isLoading && (
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="bg-card rounded-2xl border border-border px-4 py-3.5 flex items-center gap-3 animate-pulse">
                <div className="size-8 rounded-full bg-neutral-800" />
                <div className="size-10 rounded-full bg-neutral-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-800 rounded w-1/3" />
                  <div className="h-3 bg-neutral-800 rounded w-1/2" />
                </div>
                <div className="h-6 bg-neutral-800 rounded w-12" />
              </div>
            ))}
          </div>
        )}

        {rows?.map((r, i) => (
          <div
            key={r.user_id}
            className={`bg-card rounded-2xl shadow-card border border-border px-4 py-3 flex items-center gap-3 ${
              r.user_id === user?.id ? "ring-2 ring-primary" : ""
            }`}
          >
            <div
              className={`size-10 rounded-full flex items-center justify-center font-bold ${
                i === 0
                  ? "bg-gold text-gold-foreground"
                  : i === 1
                    ? "bg-muted text-muted-foreground"
                    : i === 2
                      ? "bg-amber-700/30 text-amber-900 dark:text-amber-200"
                      : "bg-secondary text-secondary-foreground"
              }`}
            >
              {i < 3 ? <Medal className="size-5" /> : i + 1}
            </div>
            <Avatar url={r.avatar_url} name={r.username} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate flex items-center gap-1.5">
                <span>{r.username}</span>
                {r.user_id === user?.id && <span className="text-xs text-primary font-bold">(tú)</span>}
                <div className="flex items-center gap-1">
                  {r.hasPlenosBadge && (
                    <span
                      className="inline-flex items-center size-5 justify-center bg-yellow-500/10 text-yellow-500 rounded-full text-[10px]"
                      title="Cazador de Plenos (+5 plenos)"
                    >
                      🎯
                    </span>
                  )}
                  {r.hasStreakBadge && (
                    <span
                      className="inline-flex items-center size-5 justify-center bg-red-500/10 text-red-500 rounded-full text-[10px] animate-pulse"
                      title="Racha de Fuego (Puntuado en los últimos 3 partidos)"
                    >
                      🔥
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {r.exactCount} exactos · {r.winnerCount} ganadores
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary tabular-nums">{r.points}</div>
              <div className="text-xs text-muted-foreground -mt-1">pts</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Avatar({ url, name, size = "medium" }: { url: string | null; name: string; size?: "xl" | "large" | "medium" | "small" }) {
  const sizeClass = 
    size === "xl" 
      ? "size-14 text-base" 
      : size === "large" 
        ? "size-12 text-sm" 
        : size === "small" 
          ? "size-8 text-[10px]" 
          : "size-10 text-xs";

  if (url) {
    const sVal = size === "xl" ? "size-14" : size === "large" ? "size-12" : size === "small" ? "size-8" : "size-10";
    return <img src={url} alt={name} className={`${sVal} rounded-full object-cover ring-2 ring-border`} />;
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
