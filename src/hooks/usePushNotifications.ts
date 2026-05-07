import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

export function usePushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const register = async () => {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== "granted") return;

      await PushNotifications.register();

      PushNotifications.addListener("registration", async (token) => {
        console.log("Push token:", token.value);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const platform = Capacitor.getPlatform(); // 'android' | 'ios'

        // Upsert token in database
        await supabase
          .from("device_push_tokens" as any)
          .upsert(
            {
              user_id: session.user.id,
              token: token.value,
              platform,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,token" }
          );
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Push received:", notification);
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("Push action:", action);
      });
    };

   const initPush = async () => {
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) return;
     await register();
   };

   initPush();
 }, [supabase.auth]);
}
