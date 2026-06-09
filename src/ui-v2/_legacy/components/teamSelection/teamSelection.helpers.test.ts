import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { loadLeagueSelectionData } from "@/ui-v2/_legacy/components/teamSelection/teamSelection.helpers";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("teamSelection.helpers", () => {
  it("returns league selection data", async () => {
    const data = {
      competitions: [
        {
          id: "lec",
          name: "LEC",
          region: "Europe",
          logo: null,
          tier: 1,
          team_count: 1,
          teams: [
            {
              id: "g2",
              name: "G2 Esports",
              short_name: "G2",
              logo_url: null,
              country: "Germany",
              ovr: 80,
            },
          ],
        },
      ],
    };

    mockedInvoke.mockResolvedValue(data);

    await expect(loadLeagueSelectionData()).resolves.toBe(data);
    expect(mockedInvoke).toHaveBeenCalledTimes(1);
  });
});
