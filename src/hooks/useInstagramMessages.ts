 import { useState, useEffect, useMemo, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { InstagramEvent } from "./useInstagramEvents";
 import { useQuery, useQueryClient } from "@tanstack/react-query";
 
 export interface InstagramConversation {
   ig_user_id: string;
   username: string;
   lastMessage: string;
   lastTimestamp: string;
   messages: InstagramEvent[];
 }
 
 export function useInstagramMessages() {
   const queryClient = useQueryClient();
   const [realtimeMessages, setRealtimeMessages] = useState<InstagramEvent[]>([]);
   const [userId, setUserId] = useState<string | null>(null);
 
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
 
     const channel = supabase
       .channel(`instagram_realtime_dm_${userId}`)
       .on(
         "postgres_changes",
         {
           event: "INSERT",
           schema: "public",
           table: "instagram_events",
           filter: `user_id=eq.${userId}`,
         },
         (payload) => {
           const newEvent = payload.new as InstagramEvent;
           if (["dm", "dm_sent", "story_reply"].includes(newEvent.event_type)) {
             setRealtimeMessages((prev) => [...prev, newEvent]);
             queryClient.invalidateQueries({ queryKey: ["instagram_dm_events", userId] });
           }
         }
       )
       .subscribe();
 
     return () => {
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
 
   const conversations = useMemo(() => {
     const map = new Map<string, InstagramConversation>();
     
     allMessages.forEach((msg) => {
       const existing = map.get(msg.ig_user_id);
       if (existing) {
         existing.messages.push(msg);
         existing.lastMessage = msg.comment_text;
         existing.lastTimestamp = msg.created_at;
       } else {
         map.set(msg.ig_user_id, {
           ig_user_id: msg.ig_user_id,
           username: msg.username || msg.ig_user_id,
           lastMessage: msg.comment_text,
           lastTimestamp: msg.created_at,
           messages: [msg],
         });
       }
     });
 
     return Array.from(map.values()).sort((a, b) => 
       new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
     );
   }, [allMessages]);
 
   return { conversations, isLoading, allMessages };
 }