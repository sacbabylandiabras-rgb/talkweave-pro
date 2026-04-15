import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionStatus {
  isPaid: boolean;
  status: string | null;
  expiresAt: string | null;
  loading: boolean;
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const [isPaid, setIsPaid] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_status, subscription_expires_at")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          const isActive = profile.subscription_status === "active";
          const notExpired = !profile.subscription_expires_at || 
            new Date(profile.subscription_expires_at) > new Date();
          
          setIsPaid(isActive && notExpired);
          setStatus(profile.subscription_status);
          setExpiresAt(profile.subscription_expires_at);
        }
      } catch (err) {
        console.error("Error checking subscription:", err);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, []);

  return { isPaid, status, expiresAt, loading };
}
