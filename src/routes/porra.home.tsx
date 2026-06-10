import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActivePorra } from "@/hooks/useActivePorra";
import { Trophy, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { calcPoints } from "@/lib/scoring";

export const Route = createFileRoute("/porra/home")({
  component: HomeTab,
});

interface Match {
  id: string;
  match_date: string;
  home_team: string;
  away_team: string;
  home_flag: string;
  away_flag: string;
  group_name: string | null;
  home_score: number | null;
  away_score: number | null;
}

interface Prediction {
  match_id: string;
  user_id: string;
  home_score: number;
  away_score: number;
}

function HomeTab() {
  const { user } = useAuth();
  const { porraId } = useActivePorra();
  const [selected, setSelected] = useState<Match | null>(null);

  const { data: porra } = useQuery({
    queryKey: ["porra", porraId],
    enabled: !!porraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("porras")
        .select("id, name, code")
        .eq("id", porraId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: matches } = useQuery({
    queryKey: ["matches"],
    queryFn: async (): Promise<Match[]> => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("match_date");
      if (error) throw error;
      return data as Match[];
    },
  });

  const { data: predictions } = useQuery({
    queryKey: ["predictions", porraId],
    enabled: !!porraId,
    queryFn: async (): Promise<Prediction[]> => {
      const { data, error } = await supabase
        .from("predictions")
        .select("match_id, user_id, home_score, away_score")
        .eq("porra_id", porraId!);
      if (error) throw error;
      return (data ?? []) as Prediction[];
    },
  });

  const myPredByMatch = new Map<string, Prediction>();
  predictions?.forEach((p) => {
    if (p.user_id === user?.id) myPredByMatch.set(p.match_id, p);
  });

  return (
    <div>
      <PorraHeader name={porra?.name} code={porra?.code} />

      <div className="px-4 max-w-md mx-auto -mt-6 space-y-3 pb-4">
        {matches?.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            myPrediction={myPredByMatch.get(m.id)}
            onOpen={() => setSelected(m)}
          />
        ))}
      </div>

      <MatchDetailDialog
        match={selected}
        onClose={() => setSelected(null)}
        predictions={predictions ?? []}
      />
    </div>
  );
}

function PorraHeader({ name, code }: { name?: string; code?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("¡Código copiado!");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="bg-gradient-hero text-white pt-8 pb-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
          <Trophy className="size-4 text-gold" />
          <span>Mundialero</span>
        </div>
        <h1 className="text-2xl font-bold">{name ?? "Tu porra"}</h1>
        <div className="mt-4 bg-white/10 backdrop-blur rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-white/70">Invita con el código</div>
            <div className="font-mono text-xl font-bold tracking-[0.3em]">{code ?? "..."}</div>
          </div>
          <button
            onClick={copy}
            className="bg-white/20 hover:bg-white/30 transition-colors rounded-lg p-2.5"
            aria-label="Copiar código"
          >
            {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  myPrediction,
  onOpen,
}: {
  match: Match;
  myPrediction?: Prediction;
  onOpen: () => void;
}) {
  const { user } = useAuth();
  const { porraId } = useActivePorra();
  const qc = useQueryClient();
  const [h, setH] = useState<string>("");
  const [a, setA] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Sync with loaded prediction
  const predKey = myPrediction ? `${myPrediction.home_score}-${myPrediction.away_score}` : "";
  useEffect(() => {
    if (myPrediction) {
      setH(String(myPrediction.home_score));
      setA(String(myPrediction.away_score));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predKey]);

  const finished = match.home_score != null && match.away_score != null;
  const points = finished && myPrediction
    ? calcPoints(myPrediction.home_score, myPrediction.away_score, match.home_score, match.away_score)
    : null;

  async function save() {
    if (!user || !porraId) return;
    const hn = parseInt(h, 10);
    const an = parseInt(a, 10);
    if (isNaN(hn) || isNaN(an) || hn < 0 || an < 0 || hn > 99 || an > 99) {
      toast.error("Marcador no válido");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("predictions").upsert(
        {
          porra_id: porraId,
          user_id: user.id,
          match_id: match.id,
          home_score: hn,
          away_score: an,
        },
        { onConflict: "porra_id,user_id,match_id" },
      );
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["predictions", porraId] });
      toast.success("Guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const date = new Date(match.match_date);
  const dateStr = date.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted-foreground">
          <span>{match.group_name ? `Grupo ${match.group_name}` : "Eliminatoria"}</span>
          <span>{dateStr}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-2xl">{match.home_flag}</span>
            <span className="font-semibold truncate">{match.home_team}</span>
          </div>
          {finished ? (
            <div className="font-bold text-lg tabular-nums">{match.home_score}–{match.away_score}</div>
          ) : (
            <div className="text-xs text-muted-foreground px-2">vs</div>
          )}
          <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
            <span className="font-semibold truncate">{match.away_team}</span>
            <span className="text-2xl">{match.away_flag}</span>
          </div>
        </div>
      </button>

      <div className="px-4 pb-3 pt-1 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex-1">Tu predicción</span>
          {points != null && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${points > 0 ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"}`}>
              +{points} pts
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Input
            type="number"
            min={0}
            max={99}
            value={h}
            onChange={(e) => setH(e.target.value)}
            disabled={finished}
            className="w-14 text-center font-bold tabular-nums"
            placeholder="-"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            max={99}
            value={a}
            onChange={(e) => setA(e.target.value)}
            disabled={finished}
            className="w-14 text-center font-bold tabular-nums"
            placeholder="-"
          />
          <Button
            size="sm"
            onClick={save}
            disabled={saving || finished || h === "" || a === ""}
            className="ml-auto bg-primary text-primary-foreground"
          >
            {saving ? "..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MatchDetailDialog({
  match,
  onClose,
  predictions,
}: {
  match: Match | null;
  onClose: () => void;
  predictions: Prediction[];
}) {
  const { porraId } = useActivePorra();
  const { data: members } = useQuery({
    queryKey: ["porra-members-profiles", porraId],
    enabled: !!porraId && !!match,
    queryFn: async () => {
      const { data: mems, error } = await supabase
        .from("porra_members")
        .select("user_id")
        .eq("porra_id", porraId!);
      if (error) throw error;
      const ids = (mems ?? []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", ids);
      if (e2) throw e2;
      return profs ?? [];
    },
  });

  if (!match) return null;

  const matchPreds = predictions.filter((p) => p.match_id === match.id);

  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-3 text-lg">
            <span className="text-2xl">{match.home_flag}</span>
            <span>{match.home_team}</span>
            <span className="text-muted-foreground">vs</span>
            <span>{match.away_team}</span>
            <span className="text-2xl">{match.away_flag}</span>
          </DialogTitle>
        </DialogHeader>
        {match.home_score != null && match.away_score != null && (
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Resultado final</div>
            <div className="text-3xl font-bold tabular-nums">
              {match.home_score} – {match.away_score}
            </div>
          </div>
        )}
        <div>
          <div className="text-sm font-semibold mb-2">Predicciones de la porra</div>
          {members && members.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {members.map((m) => {
                const p = matchPreds.find((pr) => pr.user_id === m.id);
                const pts =
                  p && match.home_score != null && match.away_score != null
                    ? calcPoints(p.home_score, p.away_score, match.home_score, match.away_score)
                    : null;
                return (
                  <div key={m.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar url={m.avatar_url} name={m.username} />
                      <span className="font-medium truncate">{m.username}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold tabular-nums">
                        {p ? `${p.home_score}–${p.away_score}` : "—"}
                      </span>
                      {pts != null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pts > 0 ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"}`}>
                          +{pts}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">Sin miembros</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return <img src={url} alt={name} className="size-8 rounded-full object-cover" />;
  }
  return (
    <div className="size-8 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
