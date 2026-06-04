import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const PERMISSION_KEYS = [
  "chat","campanhas","contatos","etiquetas","modelos","fluxos","grupos",
  "canais","comunidades","agente_ia","relatorios","aquecimento","disparo","extrair_membros"
] as const;
export type PermissionKey = typeof PERMISSION_KEYS[number];

export interface TeamState {
  loading: boolean;
  isEmployee: boolean;
  ownerId: string | null;
  effectiveUserId: string | null;
  selfUserId: string | null;
  permissions: Record<string, boolean>;
  allowedInstanceIds: string[];
  roleName: string | null;
  refresh: () => Promise<void>;
}

const TeamContext = createContext<TeamState>({
  loading: true, isEmployee: false, ownerId: null, effectiveUserId: null,
  selfUserId: null, permissions: {}, allowedInstanceIds: [], roleName: null,
  refresh: async () => {},
});

export function useTeam() { return useContext(TeamContext); }

export function hasPermission(state: TeamState, key: PermissionKey): boolean {
  if (!state.isEmployee) return true;
  return !!state.permissions[key];
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeamState>({
    loading: true, isEmployee: false, ownerId: null, effectiveUserId: null,
    selfUserId: null, permissions: {}, allowedInstanceIds: [], roleName: null,
    refresh: async () => {},
  });

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState((s) => ({ ...s, loading: false, isEmployee: false, ownerId: null, effectiveUserId: null, selfUserId: null }));
      return;
    }

    try {
      const { data: member, error } = await (supabase as any)
        .from("pipeline_members")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setState({
        loading: false,
        isEmployee: !!member,
        ownerId: user.id,
        effectiveUserId: user.id,
        selfUserId: user.id,
        permissions: {},
        allowedInstanceIds: [],
        roleName: member ? "Pipeline Member" : "Owner",
        refresh: load,
      });
    } catch (err) {
      console.error("Error loading team state:", err);
      setState({
        loading: false, isEmployee: false, ownerId: user.id, effectiveUserId: user.id,
        selfUserId: user.id, permissions: {}, allowedInstanceIds: [], roleName: null,
        refresh: load,
      });
    }
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => { sub.subscription.unsubscribe(); };
  }, [load]);

  return <TeamContext.Provider value={state}>{children}</TeamContext.Provider>;
}
