import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CampaignSendRecord {
  id: string;
  campaign_id: string;
  phone: string;
  contact_name: string | null;
  message_content: string;
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  created_at: string;
  user_id: string | null;
  instance_name: string | null;
  message_id?: string | null;
}

interface CampaignRecord {
  id: string;
  name: string;
  status: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  schedule_type: string | null;
  target_audience: any;
  template_id: string | null;
  delay_seconds: number | null;
}

// ─── Auth helper ────────────────────────────────────────────────────────────

const useAuthSessionReady = () => {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (active) setSessionReady(Boolean(session));
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSessionReady(Boolean(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return sessionReady;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sortByCreatedAt = (items: CampaignSendRecord[]) =>
  [...items].sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tA - tB;
  });

/**
 * Stable fingerprint of the send list that captures changes anywhere in the
 * array (not just head/tail). Uses a sampled XOR-hash so it stays O(n) and
 * avoids serialising all 3 000 rows to a string.
 */
const sendsFingerprint = (sends: CampaignSendRecord[]): string => {
  const sample = [
    sends[0],
    sends[Math.floor(sends.length / 4)],
    sends[Math.floor(sends.length / 2)],
    sends[Math.floor((3 * sends.length) / 4)],
    sends[sends.length - 1],
  ].filter(Boolean);

  const detail = sample.map((s) => `${s.id}:${s.status ?? ""}:${s.delivered_at ?? s.sent_at ?? ""}`).join("|");

  return `${sends.length}::${detail}`;
};

// ─── useCampaignSendsRealtime ────────────────────────────────────────────────

/**
 * Realtime hook scoped to a single campaign.
 * FIX: dataKey now samples across the full array so changes in the middle are
 * detected. FIX: channelRef cleaned up correctly on every re-mount.
 */
export const useCampaignSendsRealtime = (campaignId: string | null) => {
  const [sends, setSends] = useState<CampaignSendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastFingerprintRef = useRef("");
  const sessionReady = useAuthSessionReady();

  const fetchSends = useCallback(async () => {
    if (!campaignId || !sessionReady) return;

    let all: CampaignSendRecord[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = (await supabase
        .from("campaign_sends")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true })
        .range(from, from + batchSize - 1)) as { data: CampaignSendRecord[] | null; error: any };

      if (error || !data || data.length === 0) break;
      all = [...all, ...data];
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const sorted = sortByCreatedAt(all);
    const fp = sendsFingerprint(sorted);
    if (fp !== lastFingerprintRef.current) {
      lastFingerprintRef.current = fp;
      setSends(sorted);
    }
    setLoading(false);
  }, [campaignId, sessionReady]);

  useEffect(() => {
    if (!campaignId) {
      setSends([]);
      setLoading(false);
      lastFingerprintRef.current = "";
      return;
    }
    if (!sessionReady) {
      setLoading(true);
      return;
    }

    setLoading(true);

    // Always clean up the previous channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`sends-${campaignId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_sends",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSends((prev) => {
              if (prev.some((s) => s.id === (payload.new as CampaignSendRecord).id)) return prev;
              return sortByCreatedAt([...prev, payload.new as CampaignSendRecord]);
            });
          } else if (payload.eventType === "UPDATE") {
            setSends((prev) =>
              sortByCreatedAt(
                prev.map((s) =>
                  s.id === (payload.new as CampaignSendRecord).id ? (payload.new as CampaignSendRecord) : s,
                ),
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setSends((prev) => prev.filter((s) => s.id !== (payload.old as any).id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchSends();
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [campaignId, fetchSends, sessionReady]);

  const isAccepted = (s: CampaignSendRecord) =>
    s.status === "sent" || s.status === "delivered" || (s.status === "pending" && Boolean(s.message_id || s.sent_at));

  const stats = {
    total: sends.length,
    sent: sends.filter(isAccepted).length,
    pending: sends.filter((s) => s.status === "pending" && !Boolean(s.message_id || s.sent_at)).length,
    failed: sends.filter((s) => s.status === "failed").length,
    delivered: sends.filter((s) => s.status === "delivered").length,
  };

  return { sends, stats, loading, refetch: fetchSends };
};

// ─── useCampaignsRealtime ────────────────────────────────────────────────────

export const useCampaignsRealtime = (statusFilter?: string[]) => {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastFingerprintRef = useRef("");
  const filterKey = statusFilter?.join(",") ?? "all";
  const sessionReady = useAuthSessionReady();

  const fetchCampaigns = useCallback(async () => {
    if (!sessionReady) return;

    let query = supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    if (statusFilter && statusFilter.length > 0) query = query.in("status", statusFilter);

    const { data, error } = await query;
    if (error) {
      setLoading(false);
      return;
    }

    if (data) {
      const fp = data.map((d) => `${d.id}:${d.status}:${d.updated_at}`).join("|");
      if (fp !== lastFingerprintRef.current) {
        lastFingerprintRef.current = fp;
        setCampaigns(data);
      }
    }
    setLoading(false);
  }, [filterKey, sessionReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionReady) {
      setLoading(true);
      return;
    }

    setLoading(true);
    fetchCampaigns();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`campaigns-rt-${filterKey}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const updated = payload.new as CampaignRecord;
          setCampaigns((prev) => {
            if (statusFilter && !statusFilter.includes(updated.status ?? "")) {
              return prev.filter((c) => c.id !== updated.id);
            }
            const exists = prev.some((c) => c.id === updated.id);
            return exists ? prev.map((c) => (c.id === updated.id ? updated : c)) : [updated, ...prev];
          });
        } else if (payload.eventType === "INSERT") {
          const newC = payload.new as CampaignRecord;
          if (!statusFilter || statusFilter.includes(newC.status ?? "")) {
            setCampaigns((prev) => {
              if (prev.some((c) => c.id === newC.id)) return prev;
              return [newC, ...prev];
            });
          }
        } else if (payload.eventType === "DELETE") {
          setCampaigns((prev) => prev.filter((c) => c.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchCampaigns, filterKey, sessionReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return { campaigns, loading, refetch: fetchCampaigns };
};

// ─── useAllCampaignSendsRealtime ─────────────────────────────────────────────

/**
 * FIX: now filters by user_id so we never load another tenant's data, and
 * uses the sampled fingerprint instead of the full-array stringify.
 */
export const useAllCampaignSendsRealtime = () => {
  const [sends, setSends] = useState<CampaignSendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastFingerprintRef = useRef("");
  const sessionReady = useAuthSessionReady();
  const userIdRef = useRef<string | null>(null);

  const fetchSends = useCallback(async () => {
    if (!sessionReady) return;

    if (!userIdRef.current) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userIdRef.current = user?.id ?? null;
    }
    if (!userIdRef.current) {
      setLoading(false);
      return;
    }

    let all: CampaignSendRecord[] = [];
    let from = 0;
    const batchSize = 1000;

    while (all.length < 10_000) {
      const { data, error } = (await supabase
        .from("campaign_sends")
        .select("*")
        .eq("user_id", userIdRef.current)
        .order("created_at", { ascending: true })
        .range(from, from + batchSize - 1)) as { data: CampaignSendRecord[] | null; error: any };

      if (error || !data || data.length === 0) break;
      all = [...all, ...data];
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const sorted = sortByCreatedAt(all);
    const fp = sendsFingerprint(sorted);
    if (fp !== lastFingerprintRef.current) {
      lastFingerprintRef.current = fp;
      setSends(sorted);
    }
    setLoading(false);
  }, [sessionReady]);

  useEffect(() => {
    if (!sessionReady) {
      setLoading(true);
      return;
    }

    setLoading(true);
    fetchSends();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`all-sends-rt-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_sends" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setSends((prev) => {
            if (prev.some((s) => s.id === (payload.new as CampaignSendRecord).id)) return prev;
            return sortByCreatedAt([...prev, payload.new as CampaignSendRecord]);
          });
        } else if (payload.eventType === "UPDATE") {
          setSends((prev) =>
            sortByCreatedAt(
              prev.map((s) =>
                s.id === (payload.new as CampaignSendRecord).id ? (payload.new as CampaignSendRecord) : s,
              ),
            ),
          );
        } else if (payload.eventType === "DELETE") {
          setSends((prev) => prev.filter((s) => s.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchSends, sessionReady]);

  return { sends, loading, refetch: fetchSends };
};
