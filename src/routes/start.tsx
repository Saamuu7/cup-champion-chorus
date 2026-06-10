import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActivePorraId, setActivePorraId } from "@/hooks/useActivePorra";

export const Route = createFileRoute("/start")({
  component: StartGate,
});

function StartGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["my-porras", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("porra_members")
        .select("porra_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    if (isLoading) return;
    const memberships = data ?? [];
    const stored = getActivePorraId();
    const valid = stored && memberships.some((m) => m.porra_id === stored) ? stored : null;
    if (valid) {
      navigate({ to: "/porra/home" });
    } else if (memberships.length > 0) {
      setActivePorraId(memberships[0].porra_id);
      navigate({ to: "/porra/home" });
    } else {
      navigate({ to: "/onboarding" });
    }
  }, [user, loading, isLoading, data, navigate]);

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center text-white/80">
      Cargando...
    </div>
  );
}
