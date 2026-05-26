import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MemberCountEntry {
  count: number;
  loading: boolean;
}

interface MemberCountCache {
  [groupId: string]: MemberCountEntry;
}

export function useGroupMemberCount() {
  const [cache, setCache] = useState<MemberCountCache>({});
  // Track in-flight requests to avoid duplicate fetches
  const inFlightRef = useRef<Set<string>>(new Set());

  const fetchMemberCount = useCallback(
    async (groupId: string, sourceInstanceId?: string | null, fallbackParticipants?: any[]) => {
      if (!groupId) return 0;
      // Skip if already loading
      if (inFlightRef.current.has(groupId)) return cache[groupId]?.count ?? 0;

      inFlightRef.current.add(groupId);
      setCache((prev) => ({
        ...prev,
        [groupId]: { count: prev[groupId]?.count ?? 0, loading: true },
      }));

      try {
        const { data, error } = await supabase.functions.invoke("get-group-participants", {
          body: {
            groupId,
            sourceInstanceId: sourceInstanceId ?? null,
            fallbackParticipants: fallbackParticipants ?? [],
          },
        });

        if (error) throw error;

        const count: number = data?.participants?.length ?? 0;
        setCache((prev) => ({ ...prev, [groupId]: { count, loading: false } }));
        return count;
      } catch {
        setCache((prev) => ({
          ...prev,
          [groupId]: { count: prev[groupId]?.count ?? 0, loading: false },
        }));
        return 0;
      } finally {
        inFlightRef.current.delete(groupId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const getMemberCount = useCallback(
    (groupId: string, fallback: number): number => {
      const cached = cache[groupId];
      return cached && cached.count > 0 ? cached.count : fallback;
    },
    [cache],
  );

  /** Renamed from isLoading → isMemberCountLoading to match callers */
  const isMemberCountLoading = useCallback((groupId: string): boolean => cache[groupId]?.loading ?? false, [cache]);

  return { fetchMemberCount, getMemberCount, isMemberCountLoading };
}
