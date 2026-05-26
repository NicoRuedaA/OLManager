import { describe, it, expect } from "vitest";
import {
  resolveChampionTile,
  resolveChampionSplash,
} from "./championImages";

describe("resolveChampionTile", () => {
  it("returns /champion-tiles/{key}.webp for a simple key", () => {
    expect(resolveChampionTile("Aatrox")).toBe("/champion-tiles/Aatrox.webp");
  });

  it("normalizes the key before building the path", () => {
    expect(resolveChampionTile("FiddleSticks")).toBe("/champion-tiles/Fiddlesticks.webp");
    expect(resolveChampionTile("Wukong")).toBe("/champion-tiles/MonkeyKing.webp");
  });

  it("returns null for null input", () => {
    expect(resolveChampionTile(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(resolveChampionTile(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveChampionTile("")).toBeNull();
  });
});

describe("resolveChampionSplash", () => {
  it("returns /champion-splash/{key}.webp for a simple key", () => {
    expect(resolveChampionSplash("Ahri")).toBe("/champion-splash/Ahri.webp");
  });

  it("normalizes the key before building the path", () => {
    expect(resolveChampionSplash("FiddleSticks")).toBe("/champion-splash/Fiddlesticks.webp");
  });

  it("returns null for null input", () => {
    expect(resolveChampionSplash(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(resolveChampionSplash(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveChampionSplash("")).toBeNull();
  });
});
