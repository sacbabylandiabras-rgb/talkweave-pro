import { useEffect } from "react";

const PublicRedirectTracker = () => {
  useEffect(() => {
    if (window.location.hostname === "pay.zaplynxpro.online") {
      window.location.replace(`https://go.zaplynxpro.online${window.location.pathname}${window.location.search}${window.location.hash}`);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const normalizeDestination = (value: string) =>
      value
        .replace(/^https?:\/\/pay\.zaplynxpro\.online\/invite\//i, "https://go.zaplynxpro.online/invite/")
        .replace(/^https?:\/\/pay\.zaplynxpro\.online\/r\?/i, "https://go.zaplynxpro.online/r?");
    const destination = params.get("url") ? normalizeDestination(params.get("url")!) : null;

    if (!destination) {
      window.location.replace("/");
      return;
    }

    const trackClick = async () => {
      try {
        const trackingParams = new URLSearchParams(params);
        trackingParams.set("url", destination);
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
    <main
      style={{ background: "#ffffff", position: "fixed", inset: 0, zIndex: 9999 }}
      className="flex items-center justify-center px-4"
    >
      <p className="text-sm" style={{ color: "#6b7280" }}>Redirecionando...</p>
    </main>
  );
};

export default PublicRedirectTracker;