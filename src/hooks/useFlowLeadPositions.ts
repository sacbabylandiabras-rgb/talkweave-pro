import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FlowLeadPosition {
  id: string;
  flow_id: string;
  phone: string;
  contact_name: string | null;
  block_id: string;
  status: string;
  entered_at: string;
  updated_at: string;
}

export function useFlowLeadPositions(flowId: string | null | undefined) {
  const [positions, setPositions] = useState<FlowLeadPosition[]>([]);

  useEffect(() => {
    if (!flowId) {
      setPositions([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data } = await (supabase as any)
        .from("flow_lead_positions")
        .select("*")
        .eq("flow_id", String(flowId))
        .in("status", ["active", "waiting", "error"])
        .order("updated_at", { ascending: false })
        .limit(500);
      if (!cancelled) setPositions((data as any) || []);
    };

    load();

    const channel = supabase
      .channel(`flow_positions_${flowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "flow_lead_positions",
          filter: `flow_id=eq.${flowId}`,
        },
        (payload: any) => {
          setPositions((prev) => {
            const next = [...prev];
            const row = (payload.new || payload.old) as FlowLeadPosition;
            if (!row) return prev;
            const idx = next.findIndex((p) => p.id === row.id);
            if (payload.eventType === "DELETE") {
              return idx >= 0 ? next.filter((_, i) => i !== idx) : prev;
            }
            const isVisible = ["active", "waiting", "error"].includes(row.status);
            if (!isVisible) {
              return idx >= 0 ? next.filter((_, i) => i !== idx) : prev;
            }
            if (idx >= 0) next[idx] = row;
            else next.unshift(row);
            return next;
          });
        },
      )
      .subscribe();

    const interval = setInterval(load, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [flowId]);

  return positions;
}