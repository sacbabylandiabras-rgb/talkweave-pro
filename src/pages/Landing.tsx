import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setAuthed(!!session);
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (checking) return null;
  if (authed) return <Navigate to="/dashboard" replace />;

  return (
    <iframe
      src="/landing/index.html"
      title="ZapLynx"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
};

export default Landing;
