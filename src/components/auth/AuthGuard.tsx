import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { LAST_PROTECTED_PATH_KEY } from "@/lib/auth-route";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const location = useLocation();

  useEffect(() => {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    if (location.pathname !== "/auth") {
      localStorage.setItem(LAST_PROTECTED_PATH_KEY, nextPath);
    }
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    let cancelled = false;

    const applySession = (currentSession: Session | null) => {
      if (cancelled) return;
      setSession(currentSession);
      setChecking(false);
    };

    let subscription: { unsubscribe: () => void } | undefined;

    supabase.auth.getSession()
      .then(({ data: { session: currentSession }, error }) => {
        if (error) {
          console.warn("AuthGuard session restore warning:", error.message);
          applySession(null);
          return;
        }
        applySession(currentSession);

        if (!cancelled) {
          subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
            applySession(nextSession);
          }).data.subscription;
        }
      })
      .catch((error) => {
        console.error("AuthGuard session check error:", error);
        applySession(null);
      });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  if (checking) return null;
  
  if (!session) {
    // Redirect to auth but save the attempted path
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
