import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const applySession = (currentSession: Session | null) => {
      if (cancelled) return;
      setSession(currentSession);
      setChecking(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      applySession(currentSession);
    });

    supabase.auth.getSession()
      .then(({ data: { session: currentSession }, error }) => {
        if (error) {
          console.warn("AuthGuard session restore warning:", error.message);
          applySession(null);
          return;
        }
        applySession(currentSession);
      })
      .catch((error) => {
        console.error("AuthGuard session check error:", error);
        applySession(null);
      });

    const fallback = window.setTimeout(() => {
      if (!cancelled) {
        setSession(null);
        setChecking(false);
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  if (checking) return null;
  
  if (!session) {
    // Redirect to auth but save the attempted path
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
