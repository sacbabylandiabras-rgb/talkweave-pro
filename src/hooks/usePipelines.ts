import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PipelineStage = { id: string; label: string; color: string };

export type Pipeline = {
  id: string;
  owner_id: string;
  name: string;
  department: string | null;
  currency: string;
  stages: PipelineStage[];
  created_at?: string;
  updated_at?: string;
  /** Convenience flag: true when the current user owns the pipeline */
  is_owner: boolean;
  /** When shared with the user: their role */
  role?: "owner" | "viewer" | "editor";
};

export type PipelineMember = {
  pipeline_id: string;
  user_id: string;
  role: "viewer" | "editor";
  email?: string;
  full_name?: string;
};

export const DEFAULT_STAGES: PipelineStage[] = [
  { id: "all", label: "TODOS", color: "bg-gray-500" },
  { id: "triage", label: "AGUARDANDO", color: "bg-slate-500" },
  { id: "in_service", label: "EM ATENDIMENTO", color: "bg-blue-500" },
  { id: "pending", label: "PENDENTE", color: "bg-yellow-500" },
  { id: "completed", label: "CONCLUÍDO", color: "bg-green-500" },
  { id: "canceled", label: "CANCELADO", color: "bg-red-500" },
];

async function migrateLegacyPipelines(userId: string) {
  // If the user already has rows in `pipelines`, nothing to do.
  const { data: existing } = await (supabase as any)
    .from("pipelines")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);
  if (existing && existing.length > 0) return;

  // Look at the legacy json on profiles.pipeline_stages
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("pipeline_stages")
    .eq("id", userId)
    .single();

  const raw = profile?.pipeline_stages;
  if (!Array.isArray(raw) || raw.length === 0) return;

  let legacyPipes: { name: string; department?: string; currency?: string; stages: PipelineStage[] }[] = [];
  if ((raw[0] as any).stages) {
    legacyPipes = raw as any;
  } else {
    legacyPipes = [{ name: "Funil de Vendas", stages: raw as PipelineStage[] }];
  }

  for (const p of legacyPipes) {
    await (supabase as any).from("pipelines").insert({
      owner_id: userId,
      name: p.name || "Funil",
      department: p.department || null,
      currency: p.currency || "BRL",
      stages: p.stages || DEFAULT_STAGES,
    });
  }
}

export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPipelines([]);
        return;
      }
      setUserId(user.id);

      // Best-effort migration of legacy JSON
      try {
        await migrateLegacyPipelines(user.id);
      } catch (e) {
        console.warn("[pipelines] legacy migration skipped:", e);
      }

      // Owned pipelines
      const { data: owned, error: ownErr } = await (supabase as any)
        .from("pipelines")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });
      if (ownErr) throw ownErr;

      // Pipelines shared with me
      const { data: memberships } = await (supabase as any)
        .from("pipeline_members")
        .select("pipeline_id, role")
        .eq("user_id", user.id);

      const sharedIds = (memberships || []).map((m: any) => m.pipeline_id);
      let shared: any[] = [];
      if (sharedIds.length > 0) {
        const { data: sharedPipes } = await (supabase as any)
          .from("pipelines")
          .select("*")
          .in("id", sharedIds);
        shared = sharedPipes || [];
      }

      const roleByPipeline = new Map<string, "viewer" | "editor">(
        (memberships || []).map((m: any) => [m.pipeline_id, m.role])
      );

      const combined: Pipeline[] = [
        ...((owned as any[]) || []).map((p) => ({ ...p, is_owner: true, role: "owner" as const })),
        ...shared.map((p) => ({ ...p, is_owner: false, role: roleByPipeline.get(p.id) || "viewer" })),
      ];

      setPipelines(combined);
    } catch (err) {
      console.error("[usePipelines] refresh error:", err);
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (input: { name: string; department?: string; currency?: string; stages: PipelineStage[] }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("not authenticated");
    const { data, error } = await (supabase as any)
      .from("pipelines")
      .insert({
        owner_id: user.id,
        name: input.name,
        department: input.department || null,
        currency: input.currency || "BRL",
        stages: input.stages,
      })
      .select("*")
      .single();
    if (error) throw error;
    await refresh();
    return data as any;
  }, [refresh]);

  const update = useCallback(async (id: string, patch: Partial<Pick<Pipeline, "name" | "department" | "currency" | "stages">>) => {
    const { error } = await (supabase as any).from("pipelines").update(patch).eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from("pipelines").delete().eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const listMembers = useCallback(async (pipelineId: string): Promise<PipelineMember[]> => {
    const { data: members, error } = await (supabase as any)
      .from("pipeline_members")
      .select("pipeline_id, user_id, role")
      .eq("pipeline_id", pipelineId);
    if (error) throw error;
    if (!members || members.length === 0) return [];
    const { data: profiles } = await (supabase as any)
      .rpc("get_pipeline_member_profiles", { _pipeline_id: pipelineId });
    const byId = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
    return members.map((m: any) => ({
      ...m,
      email: byId.get(m.user_id)?.email,
      full_name: byId.get(m.user_id)?.full_name,
    }));
  }, []);

  const addMemberByEmail = useCallback(async (pipelineId: string, email: string, role: "viewer" | "editor") => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error("E-mail vazio");
    const { data: foundId } = await (supabase as any)
      .rpc("find_profile_id_by_email", { _email: cleanEmail });
    if (!foundId) throw new Error("Nenhum usuário encontrado com este e-mail");
    const { error } = await (supabase as any)
      .from("pipeline_members")
      .upsert({ pipeline_id: pipelineId, user_id: foundId, role }, { onConflict: "pipeline_id,user_id" });
    if (error) throw error;
    return foundId as string;
  }, []);

  const removeMember = useCallback(async (pipelineId: string, userIdToRemove: string) => {
    const { error } = await (supabase as any)
      .from("pipeline_members")
      .delete()
      .eq("pipeline_id", pipelineId)
      .eq("user_id", userIdToRemove);
    if (error) throw error;
  }, []);

  return {
    pipelines,
    loading,
    userId,
    refresh,
    create,
    update,
    remove,
    listMembers,
    addMemberByEmail,
    removeMember,
  };
}