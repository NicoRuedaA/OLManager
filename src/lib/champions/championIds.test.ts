import { describe, it, expect } from "vitest";
import { normalizeChampionKey } from "./championIds";

describe("normalizeChampionKey", () => {
  // ── Override entries ──────────────────────────────────────────────

  it("maps fiddlesticks → Fiddlesticks", () => {
    expect(normalizeChampionKey("FiddleSticks")).toBe("Fiddlesticks");
    expect(normalizeChampionKey("fiddlesticks")).toBe("Fiddlesticks");
    expect(normalizeChampionKey("fiddlestick")).toBe("Fiddlesticks");
  });

  it("maps wukong → MonkeyKing", () => {
    expect(normalizeChampionKey("Wukong")).toBe("MonkeyKing");
    expect(normalizeChampionKey("wukong")).toBe("MonkeyKing");
  });

  it("maps aurelionsol → AurelionSol", () => {
    expect(normalizeChampionKey("AurelionSol")).toBe("AurelionSol");
    expect(normalizeChampionKey("aurelionsol")).toBe("AurelionSol");
  });

  it("maps belveth → Belveth", () => {
    expect(normalizeChampionKey("Belveth")).toBe("Belveth");
    expect(normalizeChampionKey("belveth")).toBe("Belveth");
  });

  it("maps chogath → Chogath", () => {
    expect(normalizeChampionKey("Chogath")).toBe("Chogath");
    expect(normalizeChampionKey("chogath")).toBe("Chogath");
  });

  it("maps drmundo → DrMundo", () => {
    expect(normalizeChampionKey("DrMundo")).toBe("DrMundo");
    expect(normalizeChampionKey("drmundo")).toBe("DrMundo");
  });

  it("maps jarvaniv → JarvanIV", () => {
    expect(normalizeChampionKey("JarvanIV")).toBe("JarvanIV");
    expect(normalizeChampionKey("jarvaniv")).toBe("JarvanIV");
  });

  it("maps ksante → KSante", () => {
    expect(normalizeChampionKey("KSante")).toBe("KSante");
    expect(normalizeChampionKey("ksante")).toBe("KSante");
  });

  it("maps kaisa → Kaisa", () => {
    expect(normalizeChampionKey("Kaisa")).toBe("Kaisa");
    expect(normalizeChampionKey("kaisa")).toBe("Kaisa");
  });

  it("maps khazix → Khazix", () => {
    expect(normalizeChampionKey("Khazix")).toBe("Khazix");
    expect(normalizeChampionKey("khazix")).toBe("Khazix");
  });

  it("maps kogmaw → KogMaw", () => {
    expect(normalizeChampionKey("KogMaw")).toBe("KogMaw");
    expect(normalizeChampionKey("kogmaw")).toBe("KogMaw");
  });

  it("maps leblanc → Leblanc", () => {
    expect(normalizeChampionKey("Leblanc")).toBe("Leblanc");
    expect(normalizeChampionKey("leblanc")).toBe("Leblanc");
  });

  it("maps leesin → LeeSin", () => {
    expect(normalizeChampionKey("LeeSin")).toBe("LeeSin");
    expect(normalizeChampionKey("leesin")).toBe("LeeSin");
  });

  it("maps monkeyking → MonkeyKing", () => {
    expect(normalizeChampionKey("MonkeyKing")).toBe("MonkeyKing");
    expect(normalizeChampionKey("monkeyking")).toBe("MonkeyKing");
  });

  it("maps nunuandwillump → Nunu", () => {
    expect(normalizeChampionKey("NunuAndWillump")).toBe("Nunu");
    expect(normalizeChampionKey("nunuandwillump")).toBe("Nunu");
  });

  it("maps reksai → RekSai", () => {
    expect(normalizeChampionKey("RekSai")).toBe("RekSai");
    expect(normalizeChampionKey("reksai")).toBe("RekSai");
  });

  it("maps tahmkench → TahmKench", () => {
    expect(normalizeChampionKey("TahmKench")).toBe("TahmKench");
    expect(normalizeChampionKey("tahmkench")).toBe("TahmKench");
  });

  it("maps twistedfate → TwistedFate", () => {
    expect(normalizeChampionKey("TwistedFate")).toBe("TwistedFate");
    expect(normalizeChampionKey("twistedfate")).toBe("TwistedFate");
  });

  it("maps velkoz → Velkoz", () => {
    expect(normalizeChampionKey("Velkoz")).toBe("Velkoz");
    expect(normalizeChampionKey("velkoz")).toBe("Velkoz");
  });

  // ── Canonical passthrough ─────────────────────────────────────────

  it("passes through canonical keys unchanged", () => {
    expect(normalizeChampionKey("Aatrox")).toBe("Aatrox");
    expect(normalizeChampionKey("Ahri")).toBe("Ahri");
    expect(normalizeChampionKey("Akali")).toBe("Akali");
    expect(normalizeChampionKey("Zed")).toBe("Zed");
    expect(normalizeChampionKey("Yasuo")).toBe("Yasuo");
  });

  it("preserves the first character uppercase for canonical keys", () => {
    const result = normalizeChampionKey("aatrox");
    expect(result).toBe("Aatrox");
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it("handles mixed-case input gracefully", () => {
    expect(normalizeChampionKey("fIdDlEsTiCkS")).toBe("Fiddlesticks");
  });

  it("handles empty string by returning empty string", () => {
    expect(normalizeChampionKey("")).toBe("");
  });

  it("throws TypeError for null input", () => {
    expect(() => normalizeChampionKey(null as unknown as string)).toThrow(TypeError);
  });

  it("throws TypeError for undefined input", () => {
    expect(() => normalizeChampionKey(undefined as unknown as string)).toThrow(TypeError);
  });

  it("handles strings with special characters gracefully", () => {
    // Keys like "DrMundo" should work — no special chars in champion keys
    expect(normalizeChampionKey("DrMundo")).toBe("DrMundo");
  });
});
