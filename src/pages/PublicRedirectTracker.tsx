import { useEffect } from "react";

const PublicRedirectTracker = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const destination = params.get("url");

    if (!destination) {
      window.location.replace("/");
      return;
    }

    const trackClick = async () => {
      try {
        const trackingParams = new URLSearchParams(params);
        trackingParams.set("mode", "log");
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-flow-click?${trackingParams.toString()}`);
      } catch (error) {
        console.warn("Click tracking failed", error);
      } finally {
        window.location.replace(destination);
      }
    };

    void trackClick();
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Redirecionando...</p>
    </main>
  );
};

export default PublicRedirectTracker;