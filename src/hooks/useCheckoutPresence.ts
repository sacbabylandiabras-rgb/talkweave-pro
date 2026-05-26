import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY_PREFIX = "gateway-checkout-session:";

export const getCheckoutPresenceChannel = (ownerUserId: string) => `gateway-active-checkouts:${ownerUserId}`;

const createSessionId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getSessionId = (checkoutSlug: string): string => {
  const storageKey = `${SESSION_KEY_PREFIX}${checkoutSlug}`;
  const stored = window.sessionStorage.getItem(storageKey);
  if (stored) return stored;
  const id = createSessionId();
  window.sessionStorage.setItem(storageKey, id);
  return id;
};

interface IpInfo {
  latitude?: number;
  longitude?: number;
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
}

type Provider = () => Promise<IpInfo | null>;

const PROVIDERS: Provider[] = [
  async () => {
    const res = await fetch("https://api.ipapi.is/", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = await res.json();
    const loc = d?.location;
    if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
      return {
        latitude: loc.latitude,
        longitude: loc.longitude,
        ip: d.ip,
        city: loc.city,
        region: loc.state,
        country: loc.country,
      };
    }
    return null;
  },
  async () => {
    const res = await fetch("https://freeipapi.com/api/json/", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d.latitude === "number" && typeof d.longitude === "number") {
      return {
        latitude: d.latitude,
        longitude: d.longitude,
        ip: d.ipAddress,
        city: d.cityName,
        region: d.regionName,
        country: d.countryName,
      };
    }
    return null;
  },
  async () => {
    const res = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.success && typeof d.latitude === "number" && typeof d.longitude === "number") {
      return {
        latitude: d.latitude,
        longitude: d.longitude,
        ip: d.ip,
        city: d.city,
        region: d.region,
        country: d.country,
      };
    }
    return null;
  },
  async () => {
    const res = await fetch("https://ip-api.com/json/?fields=lat,lon,query,city,regionName,country,status", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.status === "success" && typeof d.lat === "number" && typeof d.lon === "number") {
      return { latitude: d.lat, longitude: d.lon, ip: d.query, city: d.city, region: d.regionName, country: d.country };
    }
    return null;
  },
];

/**
 * FIX: run all providers in parallel and take the first one that returns a
 * result with a city. Previously they ran sequentially which could take 16 s+.
 */
const getCoordinatesByIP = async (): Promise<IpInfo> => {
  // Wrap each provider so it resolves to null on error/timeout instead of rejecting
  const safe = (fn: Provider) => fn().catch(() => null);

  // First, fire all requests in parallel and take the first "good" result
  // (has city data). Fall back to any result with coordinates.
  return new Promise<IpInfo>((resolve) => {
    let settled = 0;
    let fallback: IpInfo | null = null;

    const tryResolve = (result: IpInfo | null) => {
      settled++;
      if (result) {
        if (result.city && String(result.city).trim().length > 0) {
          resolve(result);
          return;
        }
        if (!fallback) fallback = result;
      }
      // All providers have responded
      if (settled === PROVIDERS.length) {
        resolve(fallback ?? {});
      }
    };

    for (const provider of PROVIDERS) {
      safe(provider).then(tryResolve);
    }
  });
};

export function useCheckoutPresence(checkoutSlug?: string, ownerUserId?: string | null, productName?: string) {
  useEffect(() => {
    if (!checkoutSlug || !ownerUserId || typeof window === "undefined") return;

    const sessionId = getSessionId(checkoutSlug);
    const joinedAt = new Date().toISOString();
    const channel = supabase.channel(getCheckoutPresenceChannel(ownerUserId), {
      config: { presence: { key: sessionId } },
    });

    let isSubscribed = false;

    const trackPresence = async () => {
      if (!isSubscribed) return;
      const ipInfo = await getCoordinatesByIP();
      await channel.track({
        kind: "checkout",
        sessionId,
        checkoutSlug,
        ownerUserId,
        joinedAt,
        productName: productName ?? checkoutSlug ?? "",
        latitude: ipInfo.latitude,
        longitude: ipInfo.longitude,
        ip: ipInfo.ip,
        city: ipInfo.city,
        region: ipInfo.region,
        country: ipInfo.country,
      });
    };

    const untrackPresence = async () => {
      if (!isSubscribed) return;
      await channel.untrack();
    };

    const handleVisibleTrack = () => {
      if (document.visibilityState === "visible") void trackPresence();
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
