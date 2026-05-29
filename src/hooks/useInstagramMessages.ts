import { useState, useEffect, useMemo } from "react";
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

export function useInstagramMessages(selectedIgId?: string | null) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  // ── Eventos (mensagens) ──────────────────────────────────────────────────
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

  // ── Contatos (fotos/nomes) ───────────────────────────────────────────────
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

  // ── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const eventsChannel = supabase
      .channel(`ig_events_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instagram_events", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["instagram_dm_events", userId] });
        },
      )
      .subscribe();

    const contactsChannel = supabase
      .channel(`ig_contacts_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instagram_contacts", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["instagram_contacts", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [userId, queryClient]);

  // ── Mapa de contatos ─────────────────────────────────────────────────────
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.ig_user_id, c])), [contacts]);

  // ── Agrupa mensagens em conversas ────────────────────────────────────────
  const conversations = useMemo(() => {
    const map = new Map<string, InstagramConversation>();

    events.forEach((msg) => {
      // Para mensagens enviadas (dm_sent), o ig_user_id é o destinatário
      const contact = contactMap.get(msg.ig_user_id);
      const profilePic =
        contact?.profile_pic_url ||
        msg.payload?.sender?.profile_pic ||
        msg.payload?.message?.reply_to?.story?.url ||
        null;
      const resolvedUsername = contact?.username || msg.username || msg.ig_user_id;

      const existing = map.get(msg.ig_user_id);
      if (existing) {
        existing.messages.push(msg);
        existing.lastMessage = msg.comment_text || existing.lastMessage;
        existing.lastTimestamp = msg.created_at;
        // Atualiza foto se chegou agora
        if (profilePic && !existing.profile_pic_url) {
          existing.profile_pic_url = profilePic;
        }
        // Atualiza username se era só o ID
        if (resolvedUsername !== msg.ig_user_id) {
          existing.username = resolvedUsername;
        }
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

  const selectedConversation = useMemo(() => {
    if (!selectedIgId) return null;
    return conversations.find((c) => c.ig_user_id === selectedIgId) || null;
  }, [conversations, selectedIgId]);

  return { conversations, selectedConversation, isLoading };
}
