import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActivePorra } from "@/hooks/useActivePorra";
import { Trophy, Copy, Check, Star, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { calcPoints } from "@/lib/scoring";
import { syncMatchesFn } from "@/lib/api/sync.functions";

function getFlagUrl(emoji: string, teamName?: string) {
  if (teamName) {
    const name = teamName.toLowerCase().trim();
    if (name.includes("escocia") || name.includes("scotland")) return "https://flagcdn.com/w160/gb-sct.png";
    if (name.includes("inglaterra") || name.includes("england")) return "https://flagcdn.com/w160/gb-eng.png";
  }
  if (!emoji) return "";
  
  // Robust check for England flag emoji using code points (handles malformed db emojis too)
  const codePoints = [...emoji].map(char => char.codePointAt(0) || 0);
  const isEngland = 
    emoji === "🏴󠁧󠁢󠁥󠁮󠁧󠁿" || 
    emoji === "🏴‍󠁢󠁥󠁮󠁧󠁿" || 
    (codePoints.includes(0x1f3f4) && codePoints.includes(0xe0065) && codePoints.includes(0xe006e) && codePoints.includes(0xe0067));
  if (isEngland) return "https://flagcdn.com/w160/gb-eng.png";
  
  // Robust check for Scotland flag emoji
  const isScotland = 
    emoji === "🏴󠁧󠁢󠁳󠁣󠁴󠁿" || 
    emoji === "🏴‍󠁢󠁳󠁣󠁴󠁿" || 
    (codePoints.includes(0x1f3f4) && codePoints.includes(0xe0073) && codePoints.includes(0xe0063) && codePoints.includes(0xe0074));
  if (isScotland) return "https://flagcdn.com/w160/gb-sct.png";
  
  const charCodes = [...emoji].map(char => char.codePointAt(0));
  if (charCodes.length >= 2 && charCodes.every(code => code !== undefined && code >= 127462 && code <= 127487)) {
    const code = String.fromCharCode(...charCodes.map(code => (code || 0) - 127397)).toLowerCase();
    return `https://flagcdn.com/w160/${code}.png`;
  }
  return "";
}

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
  category?: string | null;
  stage: string;
}

interface Prediction {
  match_id: string;
  user_id: string;
  home_score: number;
  away_score: number;
  has_star: boolean;
}

function HomeTab() {
  const { user } = useAuth();
  const { porraId } = useActivePorra();
  const [selected, setSelected] = useState<Match | null>(null);
  const qc = useQueryClient();

  // Auto-sync matches with external API and auto-generate knockouts
  useEffect(() => {
    if (!user) return;
    syncMatchesFn()
      .then((res) => {
        if (res && res.success) {
          console.log("[Sync] Match sync status:", res.message);
          if (res.updatedCount > 0) {
            qc.invalidateQueries({ queryKey: ["matches"] });
            qc.invalidateQueries({ queryKey: ["predictions", porraId] });
            qc.invalidateQueries({ queryKey: ["ranking", porraId] });
          }
        }
      })
      .catch((err) => {
        console.error("[Sync] Error calling syncMatchesFn:", err);
      });
  }, [user, qc, porraId]);

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
        .select("match_id, user_id, home_score, away_score, has_star")
        .eq("porra_id", porraId!);
      if (error) throw error;
      return (data ?? []) as Prediction[];
    },
  });

  const [activeCategory, setActiveCategory] = useState<string>('J1');

  const myPredByMatch = new Map<string, Prediction>();
  if (predictions && user) {
    predictions.forEach((p) => {
      if (p.user_id === user.id) {
        myPredByMatch.set(p.match_id, p);
      }
    });
  }

  // Load members of the porra to know who is missing and calculate ratios
  const { data: members } = useQuery({
    queryKey: ["porra-members-profiles", porraId],
    enabled: !!porraId,
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

  // Categorize matches by J1/J2/J3 or knockout stage
  const matchesWithCategory = (() => {
    if (!matches) return [];
    const sortedMatches = [...matches].sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
    const groupMatchesMap = new Map<string, Match[]>();
    sortedMatches.forEach(m => {
      if (m.stage === 'group' && m.group_name) {
        if (!groupMatchesMap.has(m.group_name)) {
          groupMatchesMap.set(m.group_name, []);
        }
        groupMatchesMap.get(m.group_name)!.push(m);
      }
    });

    return sortedMatches.map(m => {
      let category = '';
      if (m.stage === 'group' && m.group_name) {
        const list = groupMatchesMap.get(m.group_name) || [];
        const idx = list.findIndex(item => item.id === m.id);
        if (idx === 0 || idx === 1) category = 'J1';
        else if (idx === 2 || idx === 3) category = 'J2';
        else if (idx === 4 || idx === 5) category = 'J3';
        else category = 'J1';
      } else {
        if (m.stage === 'r32') category = '16vos';
        else if (m.stage === 'r16') category = '8vos';
        else if (m.stage === 'qf') category = 'Cuartos';
        else if (m.stage === 'sf') category = 'Semis';
        else if (m.stage === 'final') category = 'Final';
        else category = 'Final';
      }
      return { ...m, category };
    });
  })();

  const filteredMatches = matchesWithCategory.filter(m => m.category === activeCategory);

  const [clearing, setClearing] = useState(false);

  async function clearActiveCategoryPredictions() {
    if (!user || !porraId || !matches || !predictions) return;

    const unlockedMatches = filteredMatches.filter(m => {
      const isLocked = new Date(new Date(m.match_date).getTime() - 1 * 60 * 1000) <= new Date();
      return !isLocked;
    });

    if (unlockedMatches.length === 0) {
      toast.error(`No hay partidos modificables en ${activeCategory}.`);
      return;
    }

    const myPredsToClear = predictions.filter(p => 
      p.user_id === user.id && unlockedMatches.some(m => m.id === p.match_id)
    );

    if (myPredsToClear.length === 0) {
      toast.info(`No tienes ninguna porra guardada en ${activeCategory}.`);
      return;
    }

    const confirm = window.confirm(
      `¿Estás seguro de que quieres vaciar tus porras de la fase/jornada ${activeCategory}? Se eliminarán ${myPredsToClear.length} predicciones.`
    );
    if (!confirm) return;

    setClearing(true);
    try {
      const matchIds = myPredsToClear.map(p => p.match_id);
      const { error } = await supabase
        .from("predictions")
        .delete()
        .eq("porra_id", porraId)
        .eq("user_id", user.id)
        .in("match_id", matchIds);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["predictions", porraId] });
      qc.invalidateQueries({ queryKey: ["ranking", porraId] });
      toast.success(`Se han vaciado las porras de ${activeCategory}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al vaciar las porras");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div>
      <PorraHeader name={porra?.name} code={porra?.code} />

      {/* Horizontal Tabs Selector */}
      <div className="max-w-md mx-auto px-4 mt-2 overflow-x-auto scrollbar-none flex gap-2 py-2 border-b border-neutral-900/40">
        {['J1', 'J2', 'J3', '16vos', '8vos', 'Cuartos', 'Semis', 'Final'].map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wider transition-all uppercase whitespace-nowrap ${
                isActive
                  ? "bg-[#befc30] text-black shadow-[0_2px_10px_rgba(190,252,48,0.2)] border border-[#befc30]"
                  : "bg-[#16171a] text-neutral-400 hover:text-white border border-neutral-800/80"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Control bar with title and Vaciar button */}
      {filteredMatches.length > 0 && (
        <div className="max-w-md mx-auto px-5 mt-4 flex justify-between items-center text-xs">
          <span className="text-neutral-400 font-extrabold tracking-wider uppercase">
            Partidos · {activeCategory}
          </span>
          <button
            onClick={clearActiveCategoryPredictions}
            disabled={clearing}
            className="text-red-400 hover:text-red-300 disabled:opacity-50 font-bold flex items-center gap-1 transition-all active:scale-95 bg-red-950/20 hover:bg-red-950/40 px-3 py-1 rounded-full border border-red-900/30"
          >
            {clearing ? "Vaciando..." : `Vaciar ${activeCategory}`}
          </button>
        </div>
      )}

      <div className="px-4 max-w-md mx-auto mt-2 space-y-3 pb-4">
        {filteredMatches.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-sm">
            No hay partidos programados para esta fase todavía.
          </div>
        ) : (
          filteredMatches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              myPrediction={myPredByMatch.get(m.id)}
              onOpen={() => setSelected(m)}
              members={members ?? []}
              allPredictions={predictions ?? []}
              matchesList={matches ?? []}
            />
          ))
        )}
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
  const share = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`¡Código copiado: ${code}!`);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error("Error al copiar el código");
    }
  };
  return (
    <div 
      className="relative bg-cover bg-center text-white pt-16 pb-20 px-4 flex flex-col items-center justify-center text-center overflow-hidden"
      style={{ backgroundImage: "url('/world-cup-bg.png')" }}
    >
      {/* Dark overlay to fade to black at the bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black pointer-events-none" />

      <div className="relative z-10 max-w-md w-full flex flex-col items-center">
        {/* Copy / Share invitation code button in top right */}
        {code && (
          <button
            onClick={share}
            className="absolute -top-4 right-2 bg-white/10 hover:bg-white/20 transition-all rounded-full p-2 border border-white/10 flex items-center justify-center shadow-lg active:scale-95"
            title="Copiar código de liga"
          >
            {copied ? (
              <Check className="size-4 text-lime-400" />
            ) : (
              <Copy className="size-4 text-white" />
            )}
          </button>
        )}

        <span className="text-[#befc30] text-[10px] font-extrabold tracking-[0.4em] uppercase mb-1">
          MUNDIAL 2026
        </span>
        
        <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md my-2">
          {name ?? "Tu porra"}
        </h1>

        <div className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-extrabold text-white border border-white/10 mt-1 mb-3 shadow-md tracking-wider">
          <Trophy className="size-3 text-gold" />
          <span>LA PORRA</span>
          <span className="text-[10px] text-neutral-400 font-bold ml-0.5">&gt;</span>
        </div>

        <p className="text-white/90 text-xs text-center max-w-xs drop-shadow-sm leading-relaxed px-4">
          Predice el marcador exacto de cada partido antes de que empiece.
        </p>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  myPrediction,
  onOpen,
  members = [],
  allPredictions = [],
  matchesList = [],
}: {
  match: Match;
  myPrediction?: Prediction;
  onOpen: () => void;
  members?: { id: string; username: string; avatar_url: string | null }[];
  allPredictions?: Prediction[];
  matchesList?: Match[];
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
    } else {
      setH("");
      setA("");
    }
  }, [predKey]);

  const finished = match.home_score != null && match.away_score != null;
  const points = finished && myPrediction
    ? calcPoints(myPrediction.home_score, myPrediction.away_score, match.home_score, match.away_score) * (myPrediction.has_star ? 2 : 1)
    : null;
  const isLocked = new Date(new Date(match.match_date).getTime() - 1 * 60 * 1000) <= new Date();

  async function save() {
    if (!user || !porraId) return;
    if (isLocked) {
      toast.error("Falta menos de un minuto para el partido, no puedes guardar esta porra.");
      return;
    }
    
    // If one of the fields is empty, do not save yet.
    // Also, don't reset immediately, but check if the user is moving focus to the other input of the same match.
    if (h === "" || a === "") {
      setTimeout(() => {
        const active = document.activeElement;
        const isFocusingInputs = active && active.getAttribute("data-match-input") === match.id;
        if (!isFocusingInputs) {
          if (myPrediction) {
            setH(String(myPrediction.home_score));
            setA(String(myPrediction.away_score));
          } else {
            setH("");
            setA("");
          }
        }
      }, 100);
      return;
    }

    const hn = parseInt(h, 10);
    const an = parseInt(a, 10);
    if (isNaN(hn) || isNaN(an) || hn < 0 || an < 0 || hn > 99 || an > 99) {
      if (myPrediction) {
        setH(String(myPrediction.home_score));
        setA(String(myPrediction.away_score));
      } else {
        setH("");
        setA("");
      }
      return;
    }

    if (myPrediction && hn === myPrediction.home_score && an === myPrediction.away_score) {
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
          has_star: myPrediction ? myPrediction.has_star : false,
        },
        { onConflict: "porra_id,user_id,match_id" },
      );
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["predictions", porraId] });
      toast.success("Porra guardada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStar(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user || !porraId) return;
    if (isLocked) {
      toast.error("Falta menos de un minuto para el partido, no puedes cambiar la estrella.");
      return;
    }

    if (h === "" || a === "") {
      toast.error("Primero ingresa una predicción para este partido.");
      return;
    }

    const newHasStar = !myPrediction || !myPrediction.has_star;

    if (newHasStar) {
      const otherStarPred = allPredictions?.find(p => {
        if (p.user_id !== user.id || !p.has_star || p.match_id === match.id) return false;
        const otherMatch = matchesList?.find(m => m.id === p.match_id);
        return otherMatch && otherMatch.category === match.category;
      });

      if (otherStarPred) {
        try {
          const { error } = await supabase
            .from("predictions")
            .update({ has_star: false })
            .eq("porra_id", porraId)
            .eq("user_id", user.id)
            .eq("match_id", otherStarPred.match_id);
          if (error) throw error;
        } catch (err) {
          toast.error("Error al quitar la estrella del otro partido");
          return;
        }
      }
    }

    setSaving(true);
    try {
      const hn = parseInt(h, 10);
      const an = parseInt(a, 10);
      const { error } = await supabase.from("predictions").upsert(
        {
          porra_id: porraId,
          user_id: user.id,
          match_id: match.id,
          home_score: isNaN(hn) ? 0 : hn,
          away_score: isNaN(an) ? 0 : an,
          has_star: newHasStar,
        },
        { onConflict: "porra_id,user_id,match_id" }
      );
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["predictions", porraId] });
      qc.invalidateQueries({ queryKey: ["ranking", porraId] });
      toast.success(newHasStar ? "Estrella activada (x2 puntos) ⭐" : "Estrella desactivada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  // Calculate statistics for the bottom bar
  const matchPredictions = allPredictions.filter((p) => p.match_id === match.id);
  const predictedUsers = members.filter((m) =>
    matchPredictions.some((p) => p.user_id === m.id)
  );
  const missingUsers = members.filter((m) =>
    !matchPredictions.some((p) => p.user_id === m.id)
  );

  const formatMissing = () => {
    if (missingUsers.length === 0) return "Todos listos";
    const names = missingUsers.slice(0, 2).map((u) => u.username);
    const extraCount = missingUsers.length - 2;
    if (extraCount > 0) {
      return `Faltan ${names.join(", ")}, +${extraCount}`;
    }
    return `Faltan ${names.join(", ")}`;
  };

  const missingText = members.length > 0 ? formatMissing() : "Cargando...";
  const statsText = members.length > 0 ? `${predictedUsers.length}/${members.length}` : "—";

  const date = new Date(match.match_date);
  const weekday = date.toLocaleDateString("es-ES", { weekday: "short" }).toUpperCase().replace(".", "");
  const dayMonth = date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).toUpperCase().replace(".", "");
  const timeStr = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const groupNameStr = match.group_name ? `GRUPO ${match.group_name.toUpperCase()}` : "ELIMINATORIA";
  const headerTitle = `${groupNameStr} · ${weekday}, ${dayMonth}`;

  return (
    <div 
      onClick={onOpen}
      className="bg-[#121315] border border-neutral-800/80 rounded-[22px] p-5 shadow-2xl transition-all hover:bg-[#16171a] hover:border-neutral-700/40 cursor-pointer"
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between text-[11px] text-neutral-400 font-semibold tracking-wider mb-5">
        <span>{headerTitle}</span>
        <div className="flex items-center gap-2">
          {/* Star Button */}
          <button
            onClick={toggleStar}
            className={`p-1 rounded-full transition-all hover:scale-110 active:scale-95 ${
              myPrediction?.has_star
                ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                : "text-neutral-600 hover:text-neutral-400"
            }`}
            title={myPrediction?.has_star ? "Multiplicador x2 activo" : "Activar multiplicador x2"}
          >
            <Star className={`size-4 ${myPrediction?.has_star ? "fill-yellow-400" : ""}`} />
          </button>
          <span className="bg-[#1b2216] text-[#a3e635] px-2.5 py-0.5 rounded-full font-bold">
            {timeStr}
          </span>
        </div>
      </div>

      {/* Main Row */}
      <div className="grid grid-cols-3 items-center gap-1">
        {/* Home Team */}
        <div className="flex flex-col items-center gap-2 min-w-0">
          <div className="size-16 rounded-full bg-neutral-900 border border-neutral-800/80 flex items-center justify-center shadow-lg shadow-black/20 overflow-hidden">
            {getFlagUrl(match.home_flag, match.home_team) ? (
              <img
                src={getFlagUrl(match.home_flag, match.home_team)}
                alt={match.home_team}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl">{match.home_flag}</span>
            )}
          </div>
          <span className="text-white text-xs font-bold tracking-wider mt-1 uppercase text-center w-full truncate">
            {match.home_team}
          </span>
        </div>

        {/* Center Score / Prediction Box */}
        <div className="flex flex-col items-center justify-center">
          {finished ? (
            <div className="flex flex-col items-center">
              <span className="text-[#8fa160] text-[9px] font-bold tracking-widest uppercase mb-1">
                RESULTADO
              </span>
              <span className="text-[#befc30] text-3xl font-black tracking-wider leading-none">
                {match.home_score}–{match.away_score}
              </span>
              {myPrediction ? (
                <div className="flex flex-col items-center mt-2.5 space-y-0.5">
                  <div className="text-[9px] text-neutral-400 font-extrabold uppercase tracking-widest">
                    Tu porra
                  </div>
                  <div className="text-xs font-black text-white tracking-wider">
                    {myPrediction.home_score}–{myPrediction.away_score}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {myPrediction.has_star && (
                      <span className="inline-flex items-center gap-0.5 text-yellow-400 font-extrabold text-[8px] bg-yellow-950/60 border border-yellow-800/40 px-1.5 py-0.5 rounded-full shadow-[0_1px_5px_rgba(250,204,21,0.1)]">
                        ⭐ x2
                      </span>
                    )}
                    {points !== null && (
                      <span className={`inline-flex items-center font-extrabold px-1.5 py-0.5 rounded-full text-[8px] border ${
                        points > 0 
                          ? "bg-emerald-950/60 text-emerald-400 border-emerald-900/50" 
                          : "bg-neutral-900/80 text-neutral-500 border-neutral-800/80"
                      }`}>
                        +{points} pts
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-neutral-500 text-[10px] mt-2 font-bold uppercase tracking-wider">Sin porra</span>
              )}
            </div>
          ) : isLocked ? (
            <div className="flex flex-col items-center">
              <span className="text-neutral-500 text-[9px] font-bold tracking-widest uppercase mb-1">
                PORRA CERRADA
              </span>
              <span className="text-neutral-400 text-2xl font-bold tracking-wider leading-none">
                {myPrediction ? `${myPrediction.home_score}–${myPrediction.away_score}` : "—"}
              </span>
              <span className="text-neutral-500 text-[9px] mt-2 font-medium">
                {myPrediction ? "Partido en juego / cerrado" : "No participaste"}
                {myPrediction?.has_star && <span className="text-yellow-400 font-bold text-[9px] block text-center mt-1">⭐ x2</span>}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full">
              <span className="text-[#8fa160] text-[9px] font-bold tracking-widest uppercase mb-1">
                TU PORRA
              </span>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  data-match-input={match.id}
                  value={h}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setH(val);
                  }}
                  onBlur={save}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-10 h-10 bg-neutral-800/50 border border-neutral-700/50 focus:border-[#befc30] rounded-xl text-center text-xl font-bold text-[#befc30] outline-none transition-all"
                  placeholder="-"
                />
                <span className="text-neutral-500 text-xl font-bold">-</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  data-match-input={match.id}
                  value={a}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setA(val);
                  }}
                  onBlur={save}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-10 h-10 bg-neutral-800/50 border border-neutral-700/50 focus:border-[#befc30] rounded-xl text-center text-xl font-bold text-[#befc30] outline-none transition-all"
                  placeholder="-"
                />
              </div>
              {saving && <span className="text-[9px] text-[#befc30] mt-1 animate-pulse">Guardando...</span>}
            </div>
          )}
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center gap-2 min-w-0">
          <div className="size-16 rounded-full bg-neutral-900 border border-neutral-800/80 flex items-center justify-center shadow-lg shadow-black/20 overflow-hidden">
            {getFlagUrl(match.away_flag, match.away_team) ? (
              <img
                src={getFlagUrl(match.away_flag, match.away_team)}
                alt={match.away_team}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl">{match.away_flag}</span>
            )}
          </div>
          <span className="text-white text-xs font-bold tracking-wider mt-1 uppercase text-center w-full truncate">
            {match.away_team}
          </span>
        </div>
      </div>

      {/* Separator and Stats Footer */}
      <div className="h-px bg-neutral-800/60 my-4" />
      <div className="w-full flex items-center justify-between text-[11px] text-[#befc30] px-1 font-semibold hover:text-[#befc38] transition-colors">
        <span className="text-[#befc30] text-left">{missingText}</span>
        <span className="text-[#befc30] font-mono text-right">{statsText}</span>
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
  const { user } = useAuth();
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

  // Calculate prediction distribution
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  matchPreds.forEach((p) => {
    if (p.home_score > p.away_score) homeWins++;
    else if (p.home_score === p.away_score) draws++;
    else awayWins++;
  });
  const totalPreds = matchPreds.length;
  const homePct = totalPreds ? Math.round((homeWins / totalPreds) * 100) : 0;
  const drawPct = totalPreds ? Math.round((draws / totalPreds) * 100) : 0;
  const awayPct = totalPreds ? 100 - homePct - drawPct : 0; // ensure exactly 100%

  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[#121315]/95 border border-neutral-800/80 backdrop-blur-xl text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-3 text-lg text-white">
            {getFlagUrl(match.home_flag, match.home_team) ? (
              <img
                src={getFlagUrl(match.home_flag, match.home_team)}
                alt={match.home_team}
                className="size-8 rounded-full object-cover shadow-sm"
              />
            ) : (
              <span className="text-2xl">{match.home_flag}</span>
            )}
            <span>{match.home_team}</span>
            <span className="text-muted-foreground">vs</span>
            <span>{match.away_team}</span>
            {getFlagUrl(match.away_flag, match.away_team) ? (
              <img
                src={getFlagUrl(match.away_flag, match.away_team)}
                alt={match.away_team}
                className="size-8 rounded-full object-cover shadow-sm"
              />
            ) : (
              <span className="text-2xl">{match.away_flag}</span>
            )}
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
        {totalPreds > 0 && (
          <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">
              <span>Tendencia del grupo</span>
              <span>{totalPreds} pronósticos</span>
            </div>
            <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-neutral-800">
              {homePct > 0 && (
                <div style={{ width: `${homePct}%` }} className="bg-[#befc30] h-full" title={`Local: ${homePct}%`} />
              )}
              {drawPct > 0 && (
                <div style={{ width: `${drawPct}%` }} className="bg-neutral-500 h-full" title={`Empate: ${drawPct}%`} />
              )}
              {awayPct > 0 && (
                <div style={{ width: `${awayPct}%` }} className="bg-sky-500 h-full" title={`Visitante: ${awayPct}%`} />
              )}
            </div>
            <div className="flex justify-between text-[11px] font-bold text-white pt-1">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#befc30]" /> Local: {homePct}%</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-neutral-500" /> Empate: {drawPct}%</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-500" /> Vis: {awayPct}%</span>
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
                    ? calcPoints(p.home_score, p.away_score, match.home_score, match.away_score) * (p.has_star ? 2 : 1)
                    : null;
                const isCurrentUser = m.id === user?.id;
                
                const now = new Date();
                const kickoff = new Date(match.match_date);
                const diffMs = kickoff.getTime() - now.getTime();
                
                // Oculto si quedan 10 minutos o menos para empezar el partido, y el partido aún no ha empezado
                const isHiddenWindow = diffMs > 0 && diffMs <= 10 * 60 * 1000;
                
                const canSeePrediction = isCurrentUser || !isHiddenWindow;

                return (
                  <div key={m.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar url={m.avatar_url} name={m.username} />
                      <span className="font-medium truncate">{m.username}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold tabular-nums">
                        {p ? (
                          canSeePrediction ? (
                            <span className="flex items-center gap-1">
                              {p.home_score}–{p.away_score}
                              {p.has_star && <span className="text-yellow-400 text-[10px]" title="Comodín x2 activo">⭐</span>}
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-xs font-normal flex items-center gap-1">
                              🔒 Oculto
                            </span>
                          )
                        ) : (
                          "—"
                        )}
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
