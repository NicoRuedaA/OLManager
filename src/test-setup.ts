import "@testing-library/jest-dom/vitest";

import { beforeEach } from "vitest";

// Services call `getApiClientSync()`, which throws unless a client has been
// wired up. In production that happens via environment detection in
// `getApiClient()`; in tests we install the Tauri adapter directly. The adapter
// is imported lazily inside `beforeEach` (not at module top) so it resolves
// *after* each test file's `vi.mock("@tauri-apps/api/core")` has registered —
// setup files otherwise run before per-file mocks, binding the real `invoke`.
beforeEach(async () => {
  const { setApiClient } = await import("./api/client");
  const { tauriAdapter } = await import("./api/adapters/tauri.adapter");
  setApiClient(tauriAdapter);
});
