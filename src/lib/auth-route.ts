export const LAST_PROTECTED_PATH_KEY = "zaplynx:last-protected-path";
export const DEFAULT_PROTECTED_PATH = "/dashboard";

export function normalizeProtectedPath(path?: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_PROTECTED_PATH;
  }
  if (["/", "/auth", "/login", "/reset-password"].includes(path)) {
    return DEFAULT_PROTECTED_PATH;
  }
  return path;
}