import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { autoImportDatabase } from "@/lib/dataImport";
import { loadLeagueSelectionData } from "@/ui-v2/_legacy/components/teamSelection/teamSelection.helpers";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/dataImport", () => ({
  autoImportDatabase: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);
const mockedAutoImportDatabase = vi.mocked(autoImportDatabase);

describe("teamSelection.helpers", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedAutoImportDatabase.mockReset();
  });

  it("returns existing league selection data without auto-importing", async () => {
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
    expect(mockedAutoImportDatabase).not.toHaveBeenCalled();
    expect(mockedInvoke).toHaveBeenCalledTimes(1);
  });

  it("auto-imports missing league data once and retries loading", async () => {
    const emptyData = { competitions: [] };
    const importedData = {
      competitions: [
        {
          id: "lck",
          name: "LCK",
          region: "Korea",
          logo: null,
          tier: 1,
          team_count: 1,
          teams: [
            {
              id: "t1",
              name: "T1",
              short_name: "T1",
              logo_url: null,
              country: "South Korea",
              ovr: 85,
            },
          ],
        },
      ],
    };

    mockedInvoke.mockResolvedValueOnce(emptyData).mockResolvedValueOnce(importedData);
    mockedAutoImportDatabase.mockResolvedValue({
      data_files: 4,
      photo_files: 0,
      player_count: 10,
      team_count: 1,
      staff_count: 0,
      skipped: 0,
    });

    await expect(loadLeagueSelectionData()).resolves.toBe(importedData);
    expect(mockedAutoImportDatabase).toHaveBeenCalledTimes(1);
    expect(mockedInvoke).toHaveBeenCalledTimes(2);
  });

  it("allows a later auto-import retry after a failed import", async () => {
    const emptyData = { competitions: [] };
    const importedData = {
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

    mockedInvoke.mockResolvedValueOnce(emptyData);
    mockedAutoImportDatabase.mockRejectedValueOnce(new Error("offline"));

    await expect(loadLeagueSelectionData()).rejects.toThrow("offline");

    mockedInvoke.mockResolvedValueOnce(emptyData).mockResolvedValueOnce(importedData);
    mockedAutoImportDatabase.mockResolvedValueOnce({
      data_files: 4,
      photo_files: 0,
      player_count: 10,
      team_count: 1,
      staff_count: 0,
      skipped: 0,
    });

    await expect(loadLeagueSelectionData()).resolves.toBe(importedData);
    expect(mockedAutoImportDatabase).toHaveBeenCalledTimes(2);
  });
});
