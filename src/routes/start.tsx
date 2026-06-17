import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setActivePorraId } from "@/hooks/useActivePorra";
import { Trophy, LogOut, ArrowRight, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/start")({
  component: StartGate,
});

interface PorraRelation {
  porra_id: string;
  porras: {
    id: string;
    name: string;
    code: string;
  } | null;
}

function StartGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);

  const { data, isLoading } = useQuery<PorraRelation[]>({
    queryKey: ["my-porras", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("porra_members")
        .select("porra_id, porras:porra_id(id, name, code)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []) as unknown as PorraRelation[];
    },
  });

  useEffect(() => {
    if (loading || redirecting) return;
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    if (isLoading) return;

    const memberships = data ?? [];

    if (memberships.length === 1) {
      setRedirecting(true);
      setActivePorraId(memberships[0].porra_id);
      navigate({ to: "/porra/home" });
    } else if (memberships.length === 0) {
      setRedirecting(true);
      navigate({ to: "/onboarding" });
    }
  }, [user, loading, isLoading, data, navigate, redirecting]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  function handleSelectPorra(porraId: string) {
    setActivePorraId(porraId);
    navigate({ to: "/porra/home" });
  }

  const memberships = data ?? [];

  // While checking / loading or if there's only 1 (in which case we are redirecting), show loader
  if (loading || isLoading || redirecting || memberships.length <= 1) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 text-white select-none">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat overflow-hidden pointer-events-none"
          style={{ backgroundImage: "url('/world-cup-bg.png')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90 backdrop-blur-md" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="animate-spin size-8 rounded-full border-t-2 border-r-2 border-[#befc30]" />
          <span className="text-neutral-400 text-xs font-bold uppercase tracking-widest animate-pulse">Cargando vestuario...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col p-4 sm:p-6 text-white select-none">
      {/* Background & Overlay Wrapper */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat overflow-hidden pointer-events-none"
        style={{ backgroundImage: "url('/world-cup-bg.png')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90 backdrop-blur-md" />
        <div className="absolute top-[-10%] left-[-10%] size-96 rounded-full bg-[#befc30]/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] size-96 rounded-full bg-[#befc30]/5 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <img src="/laporra-logo.png" alt="Logo" className="size-6 object-contain rounded-md" />
            <span className="font-semibold text-sm tracking-wider uppercase">LaPorra</span>
          </div>
          <button onClick={signOut} className="text-neutral-400 hover:text-white transition-colors text-sm flex items-center gap-1.5 font-bold cursor-pointer">
            <LogOut className="size-4" /> Salir
          </button>
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto py-10">
          <div className="text-center mb-8">
            <div className="size-16 rounded-2xl bg-[#121315]/80 border border-neutral-800/80 flex items-center justify-center p-3 shadow-lg mx-auto mb-4">
              <Trophy className="size-8 text-[#befc30]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-wide text-white">Tus Porras</h1>
            <p className="text-neutral-400 text-xs sm:text-sm mt-2">
              Se han detectado múltiples porras activas. Selecciona a cuál deseas acceder:
            </p>
          </div>

          {/* List of Porras */}
          <div className="space-y-3.5 mb-8">
            {memberships.map((m) => {
              const info = m.porras;
              if (!info) return null;
              return (
                <button
                  key={m.porra_id}
                  onClick={() => handleSelectPorra(m.porra_id)}
                  className="w-full bg-[#121315]/80 backdrop-blur-xl border border-neutral-800/80 rounded-[20px] p-5 shadow-lg flex items-center justify-between hover:bg-[#16171a] hover:border-neutral-700/60 transition-all duration-300 hover:scale-[1.02] text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-11 rounded-xl bg-[#befc30]/10 flex items-center justify-center text-[#befc30] group-hover:bg-[#befc30]/20 transition-colors">
                      <Users className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white group-hover:text-[#befc30] transition-colors truncate text-sm sm:text-base">
                        {info.name}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest mt-1">
                        Código: {info.code}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="size-5 text-neutral-500 group-hover:text-[#befc30] group-hover:translate-x-1 transition-all" />
                </button>
              );
            })}
          </div>

          {/* Go to onboarding (Join/Create another) */}
          <button
            onClick={() => navigate({ to: "/onboarding" })}
            className="w-full h-12 bg-neutral-900/40 hover:bg-neutral-900/80 border border-neutral-800/80 hover:border-neutral-700/60 rounded-[20px] font-bold text-xs tracking-wider uppercase text-neutral-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Crear o unirse a otra porra</span>
          </button>
        </div>
      </div>
    </div>
  );
}
