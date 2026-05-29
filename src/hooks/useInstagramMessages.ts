import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InstagramEvent } from "./useInstagramEvents";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface InstagramConversation {
  ig_user_id: string;
  username: string;
  profile_pic_url?: string;
  lastMessage: string;
  lastTimestamp: string;
  messages: InstagramEvent[];
}

// URLs do Instagram CDN expiram — verifica se a URL ainda é válida pelo campo oe= (expiry unix timestamp)
const isIgUrlExpired = (url: string | null | undefined): boolean => {
  if (!url) return true;
  if (url === "") return true;
  try {
    const match = url.match(/[?&]oe=([0-9A-Fa-f]+)/);
    if (!match) return false; // URL sem oe= provavelmente não expira
    const expiryHex = match[1];
    const expiryTs = parseInt(expiryHex, 16) * 1000; // converte hex unix -> ms
    return Date.now() > expiryTs;
  } catch {
    return false;
  }
};

// Cache de fotos já buscadas nesta sessão para não re-buscar
const fetchedPicsCache = new Set<string>();

export function useInstagramMessages(selectedIgId?: string | null) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  // ── Eventos (mensagens) ─────────────────────────────────────────────────
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["instagram_dm_events", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_events" as any)
        .select("*")
        .eq("user_id", userId)
        .in("event_type", ["dm", "dm_sent", "story_reply", "comment", "follow"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as InstagramEvent[];
    },
  });

  // ── Contatos (fotos/nomes) ──────────────────────────────────────────────
  const { data: contacts = [] } = useQuery({
    queryKey: ["instagram_contacts", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_contacts" as any)
        .select("ig_user_id, username, profile_pic_url")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []) as { ig_user_id: string; username: string; profile_pic_url: string | null }[];
    },
  });

  // ── Busca foto fresca via Edge Function quando URL está vazia ou expirada ─
  const refreshPic = useCallback(
    async (igUserId: string) => {
      if (!userId) return;
      const cacheKey = `${userId}:${igUserId}`;
      if (fetchedPicsCache.has(cacheKey)) return;
      fetchedPicsCache.add(cacheKey);

      try {
        const { data } = await supabase.functions.invoke("ig-profile-pic", {
          body: null,
          headers: {},
          method: "GET",
        });
        // Invoca via fetch direto pois a função é GET com query params
        const res = await fetch(
          `${(supabase as any).supabaseUrl}/functions/v1/ig-profile-pic?ig_user_id=${igUserId}&user_id=${userId}`,
          { headers: { Authorization: `Bearer ${(supabase as any).supabaseKey}` } },
        );
        if (res.ok) {
          // O banco já foi atualizado pela função — invalida o cache de contatos
          queryClient.invalidateQueries({ queryKey: ["instagram_contacts", userId] });
        }
      } catch (e) {
        console.warn("[useInstagramMessages] refreshPic error:", e);
      }
    },
    [userId, queryClient],
  );

  // ── Realtime ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const eventsChannel = supabase
      .channel(`ig_events_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instagram_events", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["instagram_dm_events", userId] }),
      )
      .subscribe();

    const contactsChannel = supabase
      .channel(`ig_contacts_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instagram_contacts", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["instagram_contacts", userId] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [userId, queryClient]);

  // ── Mapa de contatos ────────────────────────────────────────────────────
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.ig_user_id, c])), [contacts]);

  // ── Agrupa mensagens em conversas ───────────────────────────────────────
  const conversations = useMemo(() => {
    const map = new Map<string, InstagramConversation>();

    events.forEach((msg) => {
      const contact = contactMap.get(msg.ig_user_id);
      const storedPic = contact?.profile_pic_url;
      // Usa a foto do banco apenas se não estiver expirada
      const profilePic =
        (!isIgUrlExpired(storedPic) ? storedPic : null) ||
        msg.payload?.sender?.profile_pic ||
        msg.payload?.message?.reply_to?.story?.url ||
        null;

      const resolvedUsername =
        contact?.username && contact.username !== msg.ig_user_id ? contact.username : msg.username || msg.ig_user_id;

      const existing = map.get(msg.ig_user_id);
      if (existing) {
        existing.messages.push(msg);
        existing.lastMessage = msg.comment_text || existing.lastMessage;
        existing.lastTimestamp = msg.created_at;
        if (profilePic && !existing.profile_pic_url) existing.profile_pic_url = profilePic;
        if (resolvedUsername !== msg.ig_user_id) existing.username = resolvedUsername;
      } else {
        map.set(msg.ig_user_id, {
          ig_user_id: msg.ig_user_id,
          username: resolvedUsername,
          profile_pic_url: profilePic || undefined,
          lastMessage: msg.comment_text || "",
          lastTimestamp: msg.created_at,
          messages: [msg],
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime(),
    );
  }, [events, contactMap]);

  // ── Busca fotos expiradas/ausentes automaticamente ──────────────────────
  useEffect(() => {
    if (!userId || conversations.length === 0) return;
    conversations.forEach((conv) => {
      const contact = contactMap.get(conv.ig_user_id);
      const needsRefresh = !conv.profile_pic_url || isIgUrlExpired(contact?.profile_pic_url);
      if (needsRefresh) {
        refreshPic(conv.ig_user_id);
      }
    });
  }, [conversations, contactMap, userId, refreshPic]);

  const selectedConversation = useMemo(() => {
    if (!selectedIgId) return null;
    return conversations.find((c) => c.ig_user_id === selectedIgId) || null;
  }, [conversations, selectedIgId]);

  return { conversations, selectedConversation, isLoading };
}
