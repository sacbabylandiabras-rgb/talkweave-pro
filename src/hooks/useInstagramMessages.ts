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
 
  export function useInstagramMessages(selectedIgId?: string | null) {
   const queryClient = useQueryClient();
   const [realtimeMessages, setRealtimeMessages] = useState<InstagramEvent[]>([]);
   const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Array<{ ig_user_id: string; profile_pic_url: string | null }>>([]);
 
   useEffect(() => {
     supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
   }, []);
 
   const { data: initialEvents = [], isLoading } = useQuery({
     queryKey: ["instagram_dm_events", userId],
     enabled: !!userId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("instagram_events" as any)
         .select("*")
         .eq("user_id", userId)
         .in("event_type", ["dm", "dm_sent", "story_reply"])
         .order("created_at", { ascending: true });
       if (error) throw error;
       return (data || []) as unknown as InstagramEvent[];
     },
   });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("instagram_contacts" as any)
        .select("ig_user_id, profile_pic_url")
        .eq("user_id", userId);
      if (!cancelled && data) {
        setContacts(data as any);
      }
    })();
     // Also poll for changes periodically as profile pics might be updated by webhook
     const interval = setInterval(async () => {
       const { data } = await supabase
         .from("instagram_contacts" as any)
         .select("ig_user_id, profile_pic_url")
         .eq("user_id", userId);
       if (!cancelled && data) {
         setContacts(data as any);
       }
     }, 10000);

     return () => { 
       cancelled = true; 
       clearInterval(interval);
     };
   }, [userId, initialEvents, selectedIgId]);
 
   useEffect(() => {
     if (!userId) return;
 
     console.log("[InstagramMessages] Subscribing to realtime updates for user:", userId);
     const channel = supabase
       .channel(`instagram_realtime_dm_${userId}`)
       .on(
         "postgres_changes",
         {
           event: "*", // Listen to all events for better catch-up
           schema: "public",
           table: "instagram_events",
         },
         (payload) => {
            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;
            console.log("[InstagramMessages] Realtime event received:", payload.eventType, newRecord?.id || oldRecord?.id);
            
            const record = (newRecord || oldRecord) as InstagramEvent;
           if (!record || record.user_id !== userId) return;
 
           if (["dm", "dm_sent", "story_reply"].includes(record.event_type)) {
             if (payload.eventType === "INSERT") {
               setRealtimeMessages((prev) => {
                 if (prev.some(m => m.id === record.id)) return prev;
                 return [...prev, record];
               });
             }
             queryClient.invalidateQueries({ queryKey: ["instagram_dm_events", userId] });
           }
         }
       )
       .subscribe((status) => {
         console.log("[InstagramMessages] Realtime subscription status:", status);
       });
 
     return () => {
       console.log("[InstagramMessages] Unsubscribing from realtime");
       supabase.removeChannel(channel);
     };
   }, [queryClient, userId]);
 
   const allMessages = useMemo(() => {
     const combined = [...initialEvents];
     // Add realtime messages if they are not already in initialEvents
     realtimeMessages.forEach((msg) => {
       if (!combined.find((m) => m.id === msg.id)) {
         combined.push(msg);
       }
     });
     return combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
   }, [initialEvents, realtimeMessages]);
 
    const conversationsWithProfile = useMemo(() => {
      const map = new Map<string, InstagramConversation>();
      const contactMap = new Map(contacts.map(c => [c.ig_user_id, c.profile_pic_url]));
      
      allMessages.forEach((msg) => {
        const existing = map.get(msg.ig_user_id);
        const profilePic = msg.payload?.sender?.profile_pic || 
                          msg.payload?.message?.reply_to?.story?.url || 
                          contactMap.get(msg.ig_user_id);

        if (existing) {
          existing.messages.push(msg);
          existing.lastMessage = msg.comment_text;
          existing.lastTimestamp = msg.created_at;
          if (profilePic && !existing.profile_pic_url) {
            existing.profile_pic_url = profilePic;
          }
        } else {
          map.set(msg.ig_user_id, {
            ig_user_id: msg.ig_user_id,
            username: msg.username || msg.ig_user_id,
            profile_pic_url: profilePic,
            lastMessage: msg.comment_text,
            lastTimestamp: msg.created_at,
            messages: [msg],
          });
        }
      });
 
      return Array.from(map.values()).sort((a, b) => 
        new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
      );
    }, [allMessages, contacts]);
 
    const selectedConversation = useMemo(() => {
      if (!selectedIgId) return null;
      return conversationsWithProfile.find(c => c.ig_user_id === selectedIgId) || null;
    }, [conversationsWithProfile, selectedIgId]);

    return { conversations: conversationsWithProfile, selectedConversation, isLoading, allMessages };
 }