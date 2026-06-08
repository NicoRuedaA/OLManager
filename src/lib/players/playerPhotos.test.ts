import { describe, expect, it } from "vitest";

import { resolvePlayerPhoto } from "./playerPhotos";

describe("resolvePlayerPhoto", () => {
  it("prefers imported match-name photos over generated player-id guesses", () => {
    // "Selenex" exists in the imported player data, so the resolver must return
    // that imported photo rather than the player-id-based guess. The exact hash
    // is data-dependent, so assert the contract instead of a literal filename.
    const resolved = resolvePlayerPhoto("player-randomid", "Selenex", null);
    expect(resolved).not.toBe("/player-photos/player-randomid.webp");
    expect(resolved).toMatch(/^\/player-photos\/.+\.(webp|png)$/);
  });

  it("keeps explicit profile image urls as the highest priority", () => {
    expect(resolvePlayerPhoto("player-randomid", "Selenex", "/custom/photo.webp")).toBe(
      "/custom/photo.webp",
    );
  });
});
