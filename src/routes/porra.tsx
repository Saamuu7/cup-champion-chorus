import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home, Trophy, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActivePorra } from "@/hooks/useActivePorra";

export const Route = createFileRoute("/porra")({
  component: PorraLayout,
});

function PorraLayout() {
  const { user, loading } = useAuth();
  const { porraId } = useActivePorra();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/" });
    else if (!porraId) navigate({ to: "/onboarding" });
  }, [user, loading, porraId, navigate]);

  if (!user || !porraId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>
    );
  }

  const tabs = [
    { to: "/porra/home", label: "Inicio", icon: Home },
    { to: "/porra/ranking", label: "Ranking", icon: Trophy },
    { to: "/porra/settings", label: "Ajustes", icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 pb-24">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border safe-bottom">
        <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tabs.map((t) => {
            const active = pathname === t.to;
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`size-6 ${active ? "stroke-[2.5]" : ""}`} />
                <span className={`text-[11px] font-medium ${active ? "" : "opacity-80"}`}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
