import type { ApiClient } from "./types"

let _client: ApiClient | null = null

function isTauri(): boolean {
  return typeof window !== "undefined" && (
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window
  )
}

export async function getApiClient(): Promise<ApiClient> {
  if (_client) return _client

  if (isTauri()) {
    // In Tauri, imports are synchronous because Vite resolves @tauri-apps
    const { tauriAdapter } = await import("./adapters/tauri.adapter")
    _client = tauriAdapter
  } else {
    const { httpAdapter } = await import("./adapters/http.adapter")
    _client = httpAdapter
  }

  return _client
}

/** Call after getApiClient() has resolved. Throws if not initialized. */
export function getApiClientSync(): ApiClient {
  if (!_client) throw new Error("[ApiClient] No inicializado. Llama a getApiClient() primero.")
  return _client
}

/**
 * Override the active client. Intended for tests, which wire a specific adapter
 * (whose `invoke` is mocked) instead of going through environment detection.
 * Pass `null` to reset back to the uninitialized state.
 */
export function setApiClient(client: ApiClient | null): void {
  _client = client
}
