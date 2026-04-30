import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const isExternalUrl = (value: string) =>
  /^(https?:)?\/\//i.test(value) || /^(data|mailto|tel|blob):/i.test(value) || value.startsWith("#");

const encodePath = (path: string) => path.split("/").filter(Boolean).map(encodeURIComponent).join("/");

const toAbsoluteAssetUrl = (value: string, baseUrl: string) => {
  const trimmed = value.trim();
  if (!trimmed || isExternalUrl(trimmed)) return value;

  if (trimmed.startsWith("/functions/v1/landing-page/")) {
    return `${SUPABASE_URL}${trimmed}`;
  }

  const cleanValue = trimmed.replace(/^\/+/, "");
  return `${baseUrl}${cleanValue}`;
};

const prepareHtml = (html: string, baseUrl: string) => {
  const withAbsoluteUrls = html
    .replace(/\b(src|href|poster|action)=(['"])([^'"]+)\2/gi, (_match, attr, quote, value) => {
      return `${attr}=${quote}${toAbsoluteAssetUrl(value, baseUrl)}${quote}`;
    })
    .replace(/\bsrcset=(['"])([^'"]+)\1/gi, (_match, quote, value) => {
      const rewritten = value
        .split(",")
        .map((part: string) => {
          const pieces = part.trim().split(/\s+/);
          if (!pieces[0]) return part;
          return [toAbsoluteAssetUrl(pieces[0], baseUrl), ...pieces.slice(1)].join(" ");
        })
        .join(", ");
      return `srcset=${quote}${rewritten}${quote}`;
    })
    .replace(/url\((['"]?)(?!https?:|\/\/|data:|blob:)([^)'"]+)\1\)/gi, (_match, quote, value) => {
      return `url(${quote}${toAbsoluteAssetUrl(value, baseUrl)}${quote})`;
    });

  const baseTag = `<base href="${baseUrl}">`;
  if (/<head[^>]*>/i.test(withAbsoluteUrls)) {
    return withAbsoluteUrls.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }
  return `${baseTag}${withAbsoluteUrls}`;
};

export default function PublicLandingPreview() {
  const { pageId, "*": filePath = "" } = useParams();
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { fetchUrl, baseUrl } = useMemo(() => {
    const encodedFilePath = encodePath(filePath || "");
    const fileDir = encodedFilePath.includes("/") ? `${encodedFilePath.split("/").slice(0, -1).join("/")}/` : "";
    const root = `${SUPABASE_URL}/functions/v1/landing-page/${pageId}`;
    return {
      fetchUrl: `${root}${encodedFilePath ? `/${encodedFilePath}` : ""}`,
      baseUrl: `${root}/${fileDir}`,
    };
  }, [filePath, pageId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!pageId) {
        setError("Landing page não encontrada");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${fetchUrl}${fetchUrl.includes("?") ? "&" : "?"}preview=1`, {
          cache: "no-store",
        });
        const text = await response.text();

        if (!response.ok) throw new Error(text || "Não foi possível carregar a landing page");
        if (!cancelled) setHtml(prepareHtml(text, baseUrl));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar a landing page");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, fetchUrl, pageId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </main>
    );
  }

  return (
    <iframe
      title="Landing page"
      srcDoc={html}
      className="fixed inset-0 h-screen w-screen border-0 bg-background"
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
    />
  );
}