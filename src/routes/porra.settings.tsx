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
import { LogOut, RefreshCw, Settings as SettingsIcon, Camera, Trash2, MoreHorizontal } from "lucide-react";
import { setActivePorraId, useActivePorra } from "@/hooks/useActivePorra";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { kickMemberFn } from "@/lib/api/sync.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/porra/settings")({
  component: SettingsTab,
});

function SettingsTab() {
  const { user } = useAuth();
  const { porraId } = useActivePorra();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [saving, setSaving] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setAvatarUrl(profile.avatar_url ?? "");
      setLanguage(profile.language);
    }
  }, [profile]);

  // Query details of active porra to identify creator/admin
  const { data: porra } = useQuery({
    queryKey: ["porra-details", porraId],
    enabled: !!porraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("porras")
        .select("id, name, created_by")
        .eq("id", porraId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Query members of active porra
  const { data: members, isLoading: membersLoading } = useQuery({
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

  const isAdmin = porra && user && porra.created_by === user.id;

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
      qc.invalidateQueries({ queryKey: ["porra-members-profiles", porraId] });
      qc.invalidateQueries({ queryKey: ["ranking", porraId] });
      toast.success("Guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleKick(memberId: string, memberUsername: string) {
    if (!porraId) return;
    const confirm = window.confirm(`¿Estás seguro de que quieres expulsar a "${memberUsername}" de esta porra? Perderá todas sus predicciones y datos.`);
    if (!confirm) return;

    setKickingId(memberId);
    try {
      const res = await kickMemberFn({ data: { porraId, userIdToKick: memberId } });
      if (res && res.success) {
        toast.success(`Se ha expulsado a "${memberUsername}" correctamente.`);
        qc.invalidateQueries({ queryKey: ["porra-members-profiles", porraId] });
        qc.invalidateQueries({ queryKey: ["ranking", porraId] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al expulsar");
    } finally {
      setKickingId(null);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("La imagen es demasiado grande. El límite es de 20MB.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || "png";
      const filePath = `${user.id}.${fileExt}`;

      // Upload file to avatars bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Force refresh using timestamp
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);
      toast.success("Foto de perfil subida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
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
      <div 
        className="relative bg-cover bg-center text-white pt-16 pb-20 px-4 flex flex-col items-center justify-center text-center overflow-hidden"
        style={{ backgroundImage: "url('/world-cup-bg.png')" }}
      >
        {/* Dark overlay to fade to black at the bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black pointer-events-none" />

        <div className="relative z-10 max-w-md w-full flex flex-col items-center">
          <span className="text-[#befc30] text-[10px] font-extrabold tracking-[0.4em] uppercase mb-1">
            CONFIGURACIÓN
          </span>
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md my-2">
            Ajustes
          </h1>
          <p className="text-white/90 text-xs text-center max-w-xs drop-shadow-sm leading-relaxed px-4">
            Gestiona tu perfil, cambia de porra o cierra tu sesión.
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-4 pb-4 space-y-4">
        <div className="bg-card rounded-2xl shadow-card border border-border p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4.5 bg-neutral-900/30 p-4 rounded-xl border border-neutral-800/80">
            <div className="relative group size-16">
              <AvatarPreview url={avatarUrl} name={username} />
              {uploading && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                  <div className="animate-spin size-4 rounded-full border-t-2 border-r-2 border-[#befc30]" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1 text-center sm:text-left w-full">
              <h4 className="text-sm font-bold text-white">Foto de perfil</h4>
              <p className="text-xs text-neutral-400">Sube una foto desde tu galería (Mínimo recomendado 200x200px, máx. 20MB)</p>
              <div className="pt-1">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  disabled={uploading}
                  className="h-8 border-neutral-800/80 text-xs font-bold hover:bg-neutral-800/60 hover:text-white cursor-pointer"
                >
                  {uploading ? "Subiendo..." : "Seleccionar de la galería"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Nombre de usuario</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} />
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

        {/* Admin Section: Manage Members */}
        {isAdmin && (
          <div className="bg-card rounded-2xl shadow-card border border-border p-5 space-y-4">
            <h3 className="font-bold text-sm text-[#befc30] uppercase tracking-wider">
              Administrar Miembros
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Como creador de esta porra, tienes permisos para gestionar a los participantes y expulsarlos si es necesario:
            </p>
            <div className="space-y-2.5 pt-1">
              {membersLoading ? (
                <div className="text-center text-xs text-muted-foreground py-4 animate-pulse">
                  Cargando participantes...
                </div>
              ) : members && members.length > 0 ? (
                members.map((member) => {
                  const isSelf = member.id === user?.id;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/80 hover:border-neutral-700/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <AvatarPreview url={member.avatar_url ?? ""} name={member.username} size="small" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{member.username}</span>
                          {isSelf && (
                            <span className="text-[9px] text-[#befc30] font-extrabold uppercase tracking-widest mt-0.5">
                              Admin / Tú
                            </span>
                          )}
                        </div>
                      </div>
                      {!isSelf && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={kickingId === member.id}
                              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/60 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 bg-[#121315]/90 border border-neutral-800/80 backdrop-blur-md">
                            <DropdownMenuItem
                              onClick={() => handleKick(member.id, member.username)}
                              className="text-red-500 focus:text-red-400 focus:bg-red-950/20 font-bold cursor-pointer flex items-center gap-2"
                            >
                              <Trash2 className="size-4" />
                              <span>Expulsar de la porra</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-xs text-muted-foreground py-2">
                  No hay participantes en esta porra todavía.
                </div>
              )}
            </div>
          </div>
        )}

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

function AvatarPreview({ url, name, size = "large" }: { url: string; name: string; size?: "large" | "small" }) {
  const sizeClass = size === "small" ? "size-8 text-[10px]" : "size-16 text-xl";
  if (url) {
    return <img src={url} alt="" className={`${size === "small" ? "size-8" : "size-16"} rounded-full object-cover ring-2 ring-border`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold`}>
      {(name || "??").slice(0, 2).toUpperCase()}
    </div>
  );
}
