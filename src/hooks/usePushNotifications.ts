import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export function usePushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const register = async () => {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive === "granted") {
        await PushNotifications.register();
      }

      PushNotifications.addListener("registration", (token) => {
        console.log("Push token:", token.value);
        // TODO: salvar token no Supabase para enviar notificações
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Push received:", notification);
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("Push action:", action);
      });
    };

    register();
  }, []);
}
