/**
 * Mock de window.__TAURI_INTERNALS__ para Playwright E2E tests.
 * Permite correr el frontend contra `npm run dev` sin Tauri backend.
 *
 * Uso: inyectado via `page.addInitScript` en playwright.config.ts
 */

// Importamos el world.json para usarlo como seed data
// En runtime esto se inyecta como string, no como import ESM
declare global {
  interface Window {
    __TAURI_INTERNALS__: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}
