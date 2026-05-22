import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHUNK_RELOAD_KEY = "lovable:chunk-reload-attempts";
const MAX_RELOADS = 3;
const RELOAD_WINDOW_MS = 60_000;

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function isChunkLoadError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module") ||
    // Stale published bundle: lazy() resolved a module whose `.default` is undefined
    message.includes("Cannot read properties of undefined (reading 'default')") ||
    message.includes("undefined is not an object (evaluating") ||
    message.includes("'default' of undefined") ||
    message.includes("Cannot destructure property 'default'")
  );
}

function reloadOnce() {
  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    const parsed = raw ? JSON.parse(raw) : { count: 0, ts: 0 };
    const now = Date.now();
    const within = now - (parsed.ts || 0) < RELOAD_WINDOW_MS;
    const count = within ? parsed.count + 1 : 1;
    if (count > MAX_RELOADS) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, JSON.stringify({ count, ts: now }));
  } catch {
    /* ignore */
  }
  // Bust cache by forcing a hard reload with a query param
  const url = new URL(window.location.href);
  url.searchParams.set("__lovable_sha", Date.now().toString(36));
  window.location.replace(url.toString());
}

export function installChunkLoadRecovery() {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault?.();
    reloadOnce();
  });

  window.addEventListener("error", (event) => {
    const candidate = event.error ?? event.message;
    if (isChunkLoadError(candidate)) {
      reloadOnce();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      reloadOnce();
    }
  });
}

export function clearChunkRecoveryState() {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  
  // Clean up the URL query parameter if present
  const url = new URL(window.location.href);
  if (url.searchParams.has("__lovable_sha")) {
    url.searchParams.delete("__lovable_sha");
    const newUrl = url.pathname + url.search + url.hash;
    window.history.replaceState({}, "", newUrl);
  }
}

export function scheduleChunkRecoveryStateClear(delayMs = 15_000) {
  window.setTimeout(() => {
    clearChunkRecoveryState();
  }, delayMs);
}

export function recoverFromChunkLoadError(error: unknown) {
  if (!isChunkLoadError(error)) return false;
  reloadOnce();
  return true;
}

/**
 * Wraps React.lazy() so that if the resolved module is missing `default`
 * (a stale published bundle pointing at a removed/renamed chunk), we force
 * a one-time reload instead of letting React throw
 * `Cannot read properties of undefined (reading 'default')`.
 */
export function lazyWithRecovery<P extends object = Record<string, unknown>>(
  factory: () => Promise<{ default: ComponentType<P> } | unknown>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => {
    try {
      const mod = await factory();
      if (mod && typeof mod === "object" && "default" in mod && mod.default) {
        return mod as { default: ComponentType<P> };
      }
      // Module loaded but has no default export — stale chunk.
      reloadOnce();
      // Return a placeholder so React doesn't crash before reload kicks in.
      return { default: (() => null) as ComponentType<P> };
    } catch (err) {
      if (isChunkLoadError(err)) {
        reloadOnce();
        return { default: (() => null) as ComponentType<P> };
      }
      throw err;
    }
  });
}