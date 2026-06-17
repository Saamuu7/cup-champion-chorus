import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncMatchesFn = createServerFn({ method: "POST" })
  .validator(z.object({ force: z.boolean().optional() }).optional())
  .handler(async ({ data }) => {
    // Dynamic import to prevent bundler from pulling server-only logic into the client
    const { syncMatches } = await import("./sync.server");
    return syncMatches(data?.force);
  });

export const kickMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ porraId: z.string(), userIdToKick: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar que el solicitante es el creador (admin) de la porra
    const { data: porra, error: porraError } = await supabaseAdmin
      .from("porras")
      .select("created_by")
      .eq("id", data.porraId)
      .single();

    if (porraError || !porra) {
      throw new Error("Porra no encontrada");
    }

    if (porra.created_by !== context.userId) {
      throw new Error("No tienes permisos de administrador para esta porra");
    }

    if (context.userId === data.userIdToKick) {
      throw new Error("El administrador no se puede echar a sí mismo");
    }

    // Proceder con la eliminación del miembro
    const { error: deleteError } = await supabaseAdmin
      .from("porra_members")
      .delete()
      .eq("porra_id", data.porraId)
      .eq("user_id", data.userIdToKick);

    if (deleteError) {
      throw deleteError;
    }

    return { success: true };
  });
