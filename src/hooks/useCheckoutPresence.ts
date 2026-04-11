import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY_PREFIX = "gateway-checkout-session:";

export const getCheckoutPresenceChannel = (ownerUserId: string) => `gateway-active-checkouts:${ownerUserId}`;

const createSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getSessionId = (checkoutSlug: string) => {
  const storageKey = `${SESSION_KEY_PREFIX}${checkoutSlug}`;
  const storedSessionId = window.sessionStorage.getItem(storageKey);

  if (storedSessionId) return storedSessionId;

  const nextSessionId = createSessionId();
  window.sessionStorage.setItem(storageKey, nextSessionId);
  return nextSessionId;
};

const getCoordinatesByIP = async (): Promise<{ latitude?: number; longitude?: number }> => {
  // Try multiple providers for better accuracy
  const providers = [
    async () => {
      const res = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.success && typeof data.latitude === "number" && typeof data.longitude === "number") {
        return { latitude: data.latitude, longitude: data.longitude };
      }
      return null;
    },
    async () => {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return { latitude: data.latitude, longitude: data.longitude };
      }
      return null;
    },
    async () => {
      const res = await fetch("https://ip-api.com/json/?fields=lat,lon", { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.lat === "number" && typeof data.lon === "number") {
        return { latitude: data.lat, longitude: data.lon };
      }
      return null;
    },
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result) return result;
    } catch {
      continue;
    }
  }
  return {};
};

export function useCheckoutPresence(checkoutSlug?: string, ownerUserId?: string | null, productName?: string) {
  useEffect(() => {
    if (!checkoutSlug || !ownerUserId || typeof window === "undefined") return;

    const sessionId = getSessionId(checkoutSlug);
    const joinedAt = new Date().toISOString();
    const channel = supabase.channel(getCheckoutPresenceChannel(ownerUserId), {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    let isSubscribed = false;

    const trackPresence = async () => {
      if (!isSubscribed) return;

      const coordinates = await getCoordinatesByIP();

      await channel.track({
        kind: "checkout",
        sessionId,
        checkoutSlug,
        ownerUserId,
        joinedAt,
        productName: productName || checkoutSlug || "",
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
    };

    const untrackPresence = async () => {
      if (!isSubscribed) return;
      await channel.untrack();
    };

    const handleVisibleTrack = () => {
      if (document.visibilityState === "visible") {
        void trackPresence();
      }
    };

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      isSubscribed = true;
      await trackPresence();
    });

    document.addEventListener("visibilitychange", handleVisibleTrack);
    window.addEventListener("focus", handleVisibleTrack);
    window.addEventListener("beforeunload", untrackPresence);
    window.addEventListener("pagehide", untrackPresence);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibleTrack);
      window.removeEventListener("focus", handleVisibleTrack);
      window.removeEventListener("beforeunload", untrackPresence);
      window.removeEventListener("pagehide", untrackPresence);
      void untrackPresence();
      void supabase.removeChannel(channel);
    };
  }, [checkoutSlug, ownerUserId, productName]);
}
