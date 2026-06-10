import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogOut, RefreshCw, Settings as SettingsIcon, Camera } from "lucide-react";
import { setActivePorraId } from "@/hooks/useActivePorra";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/porra/settings")({
  component: SettingsTab,
});

function SettingsTab() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setAvatarUrl(profile.avatar_url ?? "");
      setLanguage(profile.language);
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          avatar_url: avatarUrl.trim() || null,
          language,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["porra-members-profiles"] });
      qc.invalidateQueries({ queryKey: ["ranking"] });
      toast.success("Guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setActivePorraId(null);
    navigate({ to: "/" });
  }

  function switchPorra() {
    setActivePorraId(null);
    navigate({ to: "/onboarding" });
  }

  return (
    <div>
      <div className="bg-gradient-hero text-white pt-8 pb-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
            <SettingsIcon className="size-4" />
            <span>Configuración</span>
          </div>
          <h1 className="text-2xl font-bold">Ajustes</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 pb-4 space-y-4">
        <div className="bg-card rounded-2xl shadow-card border border-border p-5 space-y-4">
          <div className="flex items-center gap-4">
            <AvatarPreview url={avatarUrl} name={username} />
            <div className="flex-1 text-sm text-muted-foreground">
              Pega una URL de imagen para tu foto de perfil
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Nombre de usuario</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="avatar" className="flex items-center gap-1.5">
              <Camera className="size-4" /> URL de foto
            </Label>
            <Input id="avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="space-y-1.5">
            <Label>Idioma</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as "es" | "en")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={save} disabled={saving || !username.trim()} className="w-full bg-gradient-primary text-primary-foreground">
            {saving ? "..." : "Guardar cambios"}
          </Button>
        </div>

        <div className="bg-card rounded-2xl shadow-card border border-border p-2 space-y-1">
          <button
            onClick={switchPorra}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted text-left"
          >
            <RefreshCw className="size-5 text-primary" />
            <span className="font-medium">Cambiar de porra</span>
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted text-left text-destructive"
          >
            <LogOut className="size-5" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground pt-2">
          {user?.email}
        </p>
      </div>
    </div>
  );
}

function AvatarPreview({ url, name }: { url: string; name: string }) {
  if (url) {
    return <img src={url} alt="" className="size-16 rounded-full object-cover ring-2 ring-border" />;
  }
  return (
    <div className="size-16 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
      {(name || "??").slice(0, 2).toUpperCase()}
    </div>
  );
}
