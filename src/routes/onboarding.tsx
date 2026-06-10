import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { setActivePorraId } from "@/hooks/useActivePorra";
import { Trophy, Plus, UserPlus, ArrowLeft, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function OnboardingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      let attempt = 0;
      let porraId: string | null = null;
      while (attempt < 5 && !porraId) {
        const newCode = genCode();
        const { data, error } = await supabase
          .from("porras")
          .insert({ name: name.trim(), code: newCode, created_by: user.id })
          .select("id")
          .single();
        if (!error && data) {
          porraId = data.id;
          break;
        }
        attempt++;
      }
      if (!porraId) throw new Error("No se pudo crear la porra");
      const { error: memErr } = await supabase
        .from("porra_members")
        .insert({ porra_id: porraId, user_id: user.id });
      if (memErr) throw memErr;
      setActivePorraId(porraId);
      qc.invalidateQueries({ queryKey: ["my-porras"] });
      toast.success("¡Porra creada!");
      navigate({ to: "/porra/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const cleaned = code.trim().toUpperCase();
      const { data: porra, error } = await supabase
        .from("porras")
        .select("id")
        .eq("code", cleaned)
        .maybeSingle();
      if (error) throw error;
      if (!porra) {
        toast.error("Código no válido");
        return;
      }
      const { error: memErr } = await supabase
        .from("porra_members")
        .insert({ porra_id: porra.id, user_id: user.id });
      if (memErr && !memErr.message.includes("duplicate")) throw memErr;
      setActivePorraId(porra.id);
      qc.invalidateQueries({ queryKey: ["my-porras"] });
      toast.success("¡Te has unido!");
      navigate({ to: "/porra/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col p-6 text-white">
      <header className="flex items-center justify-between mb-8">
        {mode !== "choose" ? (
          <button onClick={() => setMode("choose")} className="flex items-center gap-1 text-white/80">
            <ArrowLeft className="size-4" /> Atrás
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Trophy className="size-6 text-gold" />
            <span className="font-semibold">Mundialero</span>
          </div>
        )}
        <button onClick={signOut} className="text-white/70 text-sm flex items-center gap-1">
          <LogOut className="size-4" /> Salir
        </button>
      </header>

      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
        {mode === "choose" && (
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h1 className="text-3xl font-bold">Bienvenido</h1>
              <p className="text-white/80 mt-2">Crea tu porra o únete a una con un código</p>
            </div>
            <button
              onClick={() => setMode("create")}
              className="w-full bg-card text-card-foreground rounded-2xl p-5 shadow-elegant flex items-center gap-4 hover:scale-[1.02] transition-transform text-left"
            >
              <div className="size-12 rounded-xl bg-gradient-primary flex items-center justify-center text-primary-foreground">
                <Plus className="size-6" />
              </div>
              <div>
                <div className="font-semibold">Crear porra</div>
                <div className="text-sm text-muted-foreground">Genera un código e invita</div>
              </div>
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full bg-card text-card-foreground rounded-2xl p-5 shadow-elegant flex items-center gap-4 hover:scale-[1.02] transition-transform text-left"
            >
              <div className="size-12 rounded-xl bg-gold flex items-center justify-center text-gold-foreground">
                <UserPlus className="size-6" />
              </div>
              <div>
                <div className="font-semibold">Unirse a porra</div>
                <div className="text-sm text-muted-foreground">Introduce el código que te han pasado</div>
              </div>
            </button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="bg-card text-card-foreground rounded-2xl p-6 shadow-elegant space-y-4">
            <h2 className="text-xl font-semibold">Crear porra</h2>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre de la porra</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mundial con los amigos" required maxLength={50} />
            </div>
            <Button type="submit" disabled={busy || !name.trim()} className="w-full bg-gradient-primary text-primary-foreground">
              {busy ? "..." : "Crear"}
            </Button>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoin} className="bg-card text-card-foreground rounded-2xl p-6 shadow-elegant space-y-4">
            <h2 className="text-xl font-semibold">Unirse a porra</h2>
            <div className="space-y-1.5">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                required
                maxLength={6}
                className="text-center text-2xl tracking-[0.4em] font-bold uppercase"
              />
            </div>
            <Button type="submit" disabled={busy || code.length < 4} className="w-full bg-gradient-primary text-primary-foreground">
              {busy ? "..." : "Unirse"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
