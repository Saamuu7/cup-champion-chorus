import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mundialero — Acceder" },
      { name: "description", content: "Inicia sesión para crear o unirte a una porra del Mundial." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/start" });
  }, [user, loading, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("¡Cuenta creada!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center mb-8 text-white">
        <div className="size-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-4 shadow-elegant">
          <Trophy className="size-9 text-gold" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Mundialero</h1>
        <p className="text-white/80 mt-1">Porras del Mundial con amigos</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-card rounded-2xl shadow-elegant p-6 space-y-4"
      >
        <h2 className="text-xl font-semibold text-center">
          {mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
        </h2>

        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="username">Nombre de usuario</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="JuanFC"
              required
              maxLength={30}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>

        <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-elegant">
          {busy ? "..." : mode === "signin" ? "Entrar" : "Crear cuenta"}
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
        </button>
      </form>
    </div>
  );
}
