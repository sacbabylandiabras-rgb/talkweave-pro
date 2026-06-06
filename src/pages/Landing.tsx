import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const landingPaths: Record<string, string> = {
  "/": "top",
  "/recursos": "recursos",
  "/plataforma": "plataforma",
  "/comparativo": "comparativo",
  "/precos": "precos",
  "/depoimentos": "depoimentos",
  "/faq": "faq",
};

const sectionToPath = Object.fromEntries(
  Object.entries(landingPaths).map(([path, section]) => [section, path]),
);

const Landing = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const location = useLocation();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cleanupFrame: (() => void) | undefined;

    const scrollToCurrentPath = () => {
      const doc = iframe.contentDocument;
      const frameWindow = iframe.contentWindow;
      if (!doc || !frameWindow) return;
      const href = frameWindow.location.href;
      if (!href || href === "about:blank") return;
      const section = landingPaths[window.location.pathname] || "top";
      const target = doc.getElementById(section);
      if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
      try {
        if (section !== "top") frameWindow.history.replaceState(null, "", `#${section}`);
        else frameWindow.history.replaceState(null, "", "#");
      } catch {
        /* ignore cross-origin/about:blank state errors */
      }
    };

    const syncPath = (section: string, mode: "push" | "replace" = "push") => {
      const nextPath = sectionToPath[section] || "/";
      if (window.location.pathname === nextPath) return;
      window.history[mode === "push" ? "pushState" : "replaceState"](null, "", nextPath);
    };

    const setupFrame = () => {
      cleanupFrame?.();
      const doc = iframe.contentDocument;
      const frameWindow = iframe.contentWindow;
      if (!doc || !frameWindow) return;

      const onClick = (event: MouseEvent) => {
        const link = (event.target as Element | null)?.closest?.("a[href^='#']") as HTMLAnchorElement | null;
        const section = link?.getAttribute("href")?.slice(1);
        if (!section || !sectionToPath[section]) return;
        syncPath(section);
      };

      doc.addEventListener("click", onClick);
      scrollToCurrentPath();

      const sections = Object.values(landingPaths)
        .map((id) => doc.getElementById(id))
        .filter(Boolean) as HTMLElement[];

      const FrameIntersectionObserver = (frameWindow as unknown as { IntersectionObserver: typeof IntersectionObserver })
        .IntersectionObserver;

      const observer = new FrameIntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible?.target?.id) syncPath(visible.target.id, "replace");
        },
        { threshold: 0.35, rootMargin: "-18% 0px -55% 0px" },
      );

      sections.forEach((section) => observer.observe(section));
      cleanupFrame = () => {
        doc.removeEventListener("click", onClick);
        observer.disconnect();
      };
    };

    iframe.addEventListener("load", setupFrame);
    setupFrame();

    const onPopState = () => scrollToCurrentPath();
    window.addEventListener("popstate", onPopState);

    return () => {
      cleanupFrame?.();
      iframe.removeEventListener("load", setupFrame);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const initialSection = landingPaths[location.pathname] || "top";
  const iframeSrc = initialSection === "top" ? "/landing/index.html" : `/landing/index.html#${initialSection}`;

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
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
