import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Trophy, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActivePorra } from "@/hooks/useActivePorra";

export const Route = createFileRoute("/porra")({
  component: PorraLayout,
});

function SoccerFieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <circle cx="12" cy="12" r="3" />
      <path d="M2 8h3v8H2" />
      <path d="M22 8h-3v8h3" />
    </svg>
  );
}

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
      <div className="min-h-screen flex items-center justify-center text-muted-foreground bg-black">Cargando...</div>
    );
  }

  const tabs = [
    { to: "/porra/home", label: "PARTIDOS", icon: SoccerFieldIcon },
    { to: "/porra/ranking", label: "RANKING", icon: Trophy },
    { to: "/porra/settings", label: "ADMIN", icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <main className="flex-1 pb-28">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-neutral-900/60 safe-bottom">
        <div className="max-w-md mx-auto flex items-center justify-around px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {tabs.map((t) => {
            const active = pathname === t.to;
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-1.5 px-5 py-1 rounded-xl transition-colors ${
                  active ? "text-[#befc30]" : "text-neutral-500"
                }`}
              >
                <Icon className="size-6" />
                <span className="text-[10px] font-extrabold tracking-wider">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
