import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHANNEL_NAME = "gateway-active-checkouts";
const SESSION_KEY_PREFIX = "gateway-checkout-session:";

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

export function useCheckoutPresence(checkoutSlug?: string, ownerUserId?: string | null) {
  useEffect(() => {
    if (!checkoutSlug || !ownerUserId || typeof window === "undefined") return;

    const sessionId = getSessionId(checkoutSlug);
    const joinedAt = new Date().toISOString();
    const channel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    let isSubscribed = false;

    const trackPresence = async () => {
      if (!isSubscribed) return;

      await channel.track({
        sessionId,
        checkoutSlug,
        ownerUserId,
        joinedAt,
      });
    };

    const untrackPresence = async () => {
      if (!isSubscribed) return;
      await channel.untrack();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void trackPresence();
    };

    const handleBeforeUnload = () => {
      void untrackPresence();
    };

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      isSubscribed = true;
      await trackPresence();
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      void untrackPresence();
      void supabase.removeChannel(channel);
    };
  }, [checkoutSlug, ownerUserId]);
}
