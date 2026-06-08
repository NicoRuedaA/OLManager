// Resolve a root-relative public asset path (e.g. "/player-photos/x.webp") to a
// URL the current runtime can load.
//
// - Web build: the server / Vite serves these paths directly, so return as-is.
// - Tauri build: route through the custom `olm-asset://` protocol, which serves
//   imported photos from the writable app-data dir and falls back to the bundled
//   frontend assets. This is what makes auto-imported photos show up.

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Wrap a public asset path so imported photos resolve in the desktop build. */
export function assetUrl(path: string | null | undefined): string | null {
  if (path == null) return null;
  // Only rewrite root-relative paths; leave http(s)/data/blob URLs untouched.
  if (!isTauri() || !path.startsWith("/")) return path;

  const rel = path
    .slice(1)
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  // Windows serves custom schemes over http://<scheme>.localhost/...
  const isWindows =
    typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");
  return isWindows
    ? `http://olm-asset.localhost/${rel}`
    : `olm-asset://localhost/${rel}`;
}
