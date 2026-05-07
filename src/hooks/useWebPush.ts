 import { useState, useEffect, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 
 export function useWebPush() {
   const [pushEnabled, setPushEnabled] = useState(false);
   const [pushBusy, setPushBusy] = useState(false);
   const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");
 
   const getVapidPublicKey = async () => {
     const { data, error } = await supabase.functions.invoke("web-push-public-key");
     if (error || !(data as any)?.publicKey) throw error || new Error("Chave pública de push não configurada.");
     return (data as any).publicKey as string;
   };
 
   const getPushSubscriptions = async () => {
     if (!("serviceWorker" in navigator) || !("PushManager" in window)) return [];
     const regs = await navigator.serviceWorker.getRegistrations();
     const subs = await Promise.all(regs.map((reg) => reg.pushManager.getSubscription()));
     return subs.filter(Boolean) as PushSubscription[];
   };
 
   const savePushSubscription = async (sub: PushSubscription) => {
     const json = sub.toJSON() as any;
     const { data: u, error: userError } = await supabase.auth.getUser();
     if (userError || !u?.user) throw new Error("Faça login novamente para ativar o push.");
 
     const endpoint = json.endpoint || sub.endpoint;
     const p256dh = json.keys?.p256dh;
     const authKey = json.keys?.auth;
     if (!endpoint || !p256dh || !authKey) throw new Error("Inscrição push inválida.");
 
     const { error } = await (supabase as any).from("web_push_subscriptions").upsert({
       user_id: u.user.id,
       endpoint,
       p256dh,
       auth: authKey,
       user_agent: navigator.userAgent,
       last_used_at: new Date().toISOString(),
     }, { onConflict: "endpoint" });
     if (error) throw error;
   };
 
   const syncPushSubscription = useCallback(async () => {
     const subs = await getPushSubscriptions();
     if (subs.length === 0) {
       setPushEnabled(false);
       return;
     }
     for (const sub of subs) await savePushSubscription(sub);
     setPushEnabled(true);
   }, []);
 
   useEffect(() => {
     if ("Notification" in window) {
       setPermissionStatus(Notification.permission);
     }
     syncPushSubscription().catch(() => setPushEnabled(false));
   }, [syncPushSubscription]);
 
   const enablePush = async () => {
     if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
       throw new Error("Seu navegador não suporta notificações push.");
     }
     setPushBusy(true);
     try {
       const perm = await Notification.requestPermission();
       setPermissionStatus(perm);
       if (perm !== "granted") {
         setPushEnabled(false);
         return;
       }
       
       const vapidPublicKey = await getVapidPublicKey();
       const reg = await navigator.serviceWorker.register("/sw-push.js");
       await navigator.serviceWorker.ready;
       
       let sub = await reg.pushManager.getSubscription();
       if (!sub) {
         sub = await reg.pushManager.subscribe({
           userVisibleOnly: true,
           applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
         });
       }
       await savePushSubscription(sub);
       setPushEnabled(true);
     } catch (e: any) {
       setPushEnabled(false);
       throw e;
     } finally {
       setPushBusy(false);
     }
   };
 
   const disablePush = async () => {
     setPushBusy(true);
     try {
       const subs = await getPushSubscriptions();
       for (const sub of subs) {
         const endpoint = sub.endpoint;
         await sub.unsubscribe();
         await (supabase as any).from("web_push_subscriptions").delete().eq("endpoint", endpoint);
       }
       setPushEnabled(false);
     } finally {
       setPushBusy(false);
     }
   };
 
   return { pushEnabled, pushBusy, permissionStatus, enablePush, disablePush };
 }
 
 function urlBase64ToUint8Array(base64String: string) {
   const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
   const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
   const raw = atob(base64);
   const out = new Uint8Array(raw.length);
   for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
   return out;
 }