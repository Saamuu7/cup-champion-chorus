import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy, Mail, Lock, User, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LaPorra — Acceder" },
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
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSplash(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && !splash && user) navigate({ to: "/start" });
  }, [user, loading, splash, navigate]);

  const showLoader = loading || splash;

  if (showLoader) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 text-white select-none">
        {/* Background & Overlay Wrapper */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat overflow-hidden pointer-events-none"
          style={{ backgroundImage: "url('/world-cup-bg.png')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/60 to-black/95 backdrop-blur-md" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-[#befc30]/5 blur-[120px]" />
        </div>

        {/* Logo & Spinner Container */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6">
          <div className="size-28 rounded-[32px] bg-[#121315]/90 border border-neutral-800/80 flex items-center justify-center p-5.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] animate-pulse">
            <img
              src="/laporra-logo.png"
              alt="LaPorra Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-[0.3em] uppercase text-white">LaPorra</h1>
            <p className="text-[9px] text-neutral-400 font-extrabold tracking-[0.4em] uppercase">MUNDIAL 2026</p>
          </div>
          
          <div className="pt-4 flex flex-col items-center gap-3">
            <div className="animate-spin size-7 rounded-full border-2 border-t-[#befc30] border-r-transparent border-b-transparent border-l-transparent" />
            <span className="text-[9px] text-[#befc30] font-extrabold uppercase tracking-widest animate-pulse">
              Preparando vestuario...
            </span>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Background & Overlay Wrapper */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat overflow-hidden pointer-events-none"
        style={{ backgroundImage: "url('/world-cup-bg.png')" }}
      >
        {/* Premium dark gradient overlay with backdrop blur */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90 backdrop-blur-md" />
        
        {/* Decorative soccer stadium light spots */}
        <div className="absolute top-[-10%] left-[-10%] size-96 rounded-full bg-[#befc30]/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] size-96 rounded-full bg-[#befc30]/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md my-auto flex flex-col items-center justify-center py-6">
        {/* App Logo and Branding */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="size-20 rounded-3xl bg-[#121315]/80 border border-neutral-800/80 flex items-center justify-center p-3 shadow-[0_15px_35px_rgba(0,0,0,0.5)] overflow-hidden transition-transform duration-500 hover:rotate-6 hover:scale-105">
            <img
              src="/laporra-logo.png"
              alt="LaPorra Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Premium Glassmorphic Form Card */}
        <form
          onSubmit={onSubmit}
          className="w-full bg-[#121315]/80 backdrop-blur-xl border border-neutral-800/80 rounded-[24px] p-6 sm:p-8 space-y-5 shadow-[0_25px_50px_rgba(0,0,0,0.5)]"
        >
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {mode === "signin" ? "¡Hola de nuevo!" : "Únete al juego"}
            </h2>
            <p className="text-neutral-400 text-xs">
              {mode === "signin" ? "Inicia sesión para revisar tus puntos." : "Crea tu cuenta y empieza a pronosticar."}
            </p>
          </div>

          <div className="space-y-4.5">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Nombre de usuario
                </Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="JuanFC"
                    required
                    maxLength={30}
                    className="pl-11 h-11 bg-neutral-900/40 border-neutral-800/80 focus:border-[#befc30] rounded-xl text-white placeholder-neutral-500 transition-all focus:ring-0 outline-none font-medium text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  autoComplete="email"
                  className="pl-11 h-11 bg-neutral-900/40 border-neutral-800/80 focus:border-[#befc30] rounded-xl text-white placeholder-neutral-500 transition-all focus:ring-0 outline-none font-medium text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="pl-11 h-11 bg-neutral-900/40 border-neutral-800/80 focus:border-[#befc30] rounded-xl text-white placeholder-neutral-500 transition-all focus:ring-0 outline-none font-medium text-sm"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full h-11 bg-[#befc30] text-black font-extrabold text-sm rounded-xl transition-all duration-300 hover:bg-[#cbfd4b] hover:shadow-[0_0_20px_rgba(190,252,48,0.4)] active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg mt-2"
          >
            {busy ? (
              <span className="animate-pulse">Cargando...</span>
            ) : (
              <>
                <span>{mode === "signin" ? "Entrar al vestuario" : "Registrarme"}</span>
                <Sparkles className="size-4" />
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-xs font-bold text-neutral-400 hover:text-white transition-colors py-1 cursor-pointer"
          >
            {mode === "signin" ? "¿No tienes cuenta? Crea una gratis" : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}

