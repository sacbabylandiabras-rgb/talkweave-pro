import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MemberCountCache {
  [groupId: string]: { count: number; loading: boolean };
}

export function useGroupMemberCount() {
  const [cache, setCache] = useState<MemberCountCache>({});

  const fetchMemberCount = useCallback(async (groupId: string, sourceInstanceId?: string | null, fallbackParticipants?: any[]) => {
    if (!groupId) return;
    
    setCache((prev) => ({ ...prev, [groupId]: { count: prev[groupId]?.count || 0, loading: true } }));

    try {
      const { data, error } = await supabase.functions.invoke("get-group-participants", {
        body: { groupId, sourceInstanceId: sourceInstanceId || null, fallbackParticipants: fallbackParticipants || [] },
      });

      if (error) throw error;

      const count = data?.participants?.length || 0;
      setCache((prev) => ({ ...prev, [groupId]: { count, loading: false } }));
      return count;
    } catch {
      setCache((prev) => ({ ...prev, [groupId]: { count: prev[groupId]?.count || 0, loading: false } }));
      return 0;
    }
  }, []);

  const getMemberCount = useCallback((groupId: string, fallback: number) => {
    const cached = cache[groupId];
    if (cached && cached.count > 0) return cached.count;
    return fallback;
  }, [cache]);

  const isLoading = useCallback((groupId: string) => {
    return cache[groupId]?.loading || false;
  }, [cache]);

  return { fetchMemberCount, getMemberCount, isLoading };
}
