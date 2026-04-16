const CHUNK_RELOAD_KEY = "lovable:chunk-reload-attempted";

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
    message.includes("error loading dynamically imported module")
  );
}

function reloadOnce() {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") {
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
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
}