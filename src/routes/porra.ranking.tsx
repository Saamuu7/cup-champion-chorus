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
          .select("user_id, match_id, home_score, away_score")
          .eq("porra_id", porraId!),
        supabase
          .from("matches")
          .select("id, home_score, away_score")
          .not("home_score", "is", null),
      ]);

      const ids = (mems ?? []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", ids);

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
        });
      });

      (preds ?? []).forEach((p) => {
        const m = matchById.get(p.match_id);
        if (!m) return;
        const pts = calcPoints(p.home_score, p.away_score, m.home_score, m.away_score);
        const row = byUser.get(p.user_id);
        if (!row) return;
        row.points += pts;
        if (pts === 5) row.exactCount++;
        else if (pts === 3) row.winnerCount++;
      });

      return Array.from(byUser.values()).sort((a, b) => b.points - a.points);
    },
  });

  return (
    <div>
      <div className="bg-gradient-hero text-white pt-8 pb-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
            <Trophy className="size-4 text-gold" />
            <span>Clasificación</span>
          </div>
          <h1 className="text-2xl font-bold">Ranking</h1>
          <p className="text-white/70 text-sm mt-1">
            5 pts marcador exacto · 3 pts acertar ganador
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 pb-4 space-y-2">
        {isLoading && <div className="text-center text-muted-foreground py-8">Cargando...</div>}
        {rows?.map((r, i) => (
          <div
            key={r.user_id}
            className={`bg-card rounded-2xl shadow-card border border-border px-4 py-3 flex items-center gap-3 ${
              r.user_id === user?.id ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className={`size-10 rounded-full flex items-center justify-center font-bold ${
              i === 0 ? "bg-gold text-gold-foreground" :
              i === 1 ? "bg-muted text-muted-foreground" :
              i === 2 ? "bg-amber-700/30 text-amber-900 dark:text-amber-200" :
              "bg-secondary text-secondary-foreground"
            }`}>
              {i < 3 ? <Medal className="size-5" /> : i + 1}
            </div>
            <Avatar url={r.avatar_url} name={r.username} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {r.username}
                {r.user_id === user?.id && <span className="ml-1 text-xs text-primary">(tú)</span>}
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

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img src={url} alt={name} className="size-10 rounded-full object-cover" />;
  return (
    <div className="size-10 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
