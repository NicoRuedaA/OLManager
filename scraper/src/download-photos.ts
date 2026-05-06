#!/usr/bin/env tsx
/** Download photos using cached parse results for correct filenames */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const PP = "output/player-photos";
const SP = "output/staff-photos";
const LP = "output/team-logos";
for (const d of [PP, SP, LP]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

const CACHE = ".cache";
const API = "https://lol.fandom.com/api.php";
const UA = "OLManager/0.1";

function cached(page: string): { wikitext?: string; images?: string[] } | null {
  const params = { action: "parse", page, prop: "wikitext|images" };
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  const key = crypto.createHash("md5").update(sorted).digest("hex").slice(0, 12);
  const fp = path.join(CACHE, `${key}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return { wikitext: d.parse?.wikitext?.["*"], images: d.parse?.images ?? [] };
  } catch { return null; }
}

function pickPhoto(images: string[]): string | null {
  // Prefer main player image (not square icons, not logos)
  for (const img of images) {
    const n = img.toLowerCase();
    if (n.includes("square") || n.includes("logo") || n.includes("icon")) continue;
    if (n.endsWith(".jpg") || n.endsWith(".png") || n.endsWith(".jpeg")) return img;
  }
  // Fallback: any image
  for (const img of images) {
    if (img.endsWith(".jpg") || img.endsWith(".png")) return img;
  }
  return null;
}

let lastReq = 0;
async function resolveUrl(filename: string): Promise<string | null> {
  const wait = 500 - (Date.now() - lastReq);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReq = Date.now();
  try {
    const url = `${API}?action=query&titles=File:${encodeURIComponent(filename.replace(/ /g, "_"))}&prop=imageinfo&iiprop=url&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    const json: any = await res.json();
    const page = Object.values(json.query?.pages ?? {})[0] as any;
    return page?.imageinfo?.[0]?.url ?? null;
  } catch { return null; }
}

async function batch(destDir: string, items: any[], label: string, size: number) {
  let ok = 0, noPhoto = 0, fail = 0;
  const total = items.length;
  console.log(`\n${label}: ${total} items`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const webpPath = path.join(destDir, `${item.photoId}.webp`);
    if (fs.existsSync(webpPath)) { ok++; continue; }

    // Get cached parse to find actual image filename
    const cache = cached(item.ign);
    if (!cache || !cache.images || cache.images.length === 0) {
      if (noPhoto === 0) console.log(`  ${item.ign}: no cached parse images`);
      noPhoto++;
      continue;
    }

    const img = pickPhoto(cache.images);
    if (!img) { noPhoto++; continue; }

    const url = await resolveUrl(img);
    if (!url) { noPhoto++; continue; }

    try {
      await new Promise(r => setTimeout(r, 200));
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) { fail++; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const webp = await sharp(buf).resize(size, size, { fit: "cover", position: "center" }).webp({ quality: 80 }).toBuffer();
      fs.writeFileSync(webpPath, webp);
      ok++;
    } catch { fail++; }

    if ((i + 1) % 100 === 0 || i === 0) {
      console.log(`  ${label}: ${i + 1}/${total} — ${ok} OK, ${noPhoto} sin foto, ${fail} errores`);
    }
  }
  console.log(`  ${label}: ✅ ${ok}/${total} (${noPhoto} sin foto, ${fail} errores)`);
  return { ok, noPhoto, fail };
}

async function logos(items: any[]) {
  let ok = 0;
  console.log(`\nLogos: ${items.length} equipos`);
  for (let i = 0; i < items.length; i++) {
    const t = items[i];
    const safe = t.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const dest = path.join(LP, `${safe}.webp`);
    if (fs.existsSync(dest)) { ok++; continue; }

    // Find logo from cached team page
    const cache = cached(t.name);
    if (!cache?.images) continue;
    const logoImg = cache.images.find((img: string) => img.toLowerCase().includes("logo"));
    if (!logoImg) continue;

    const url = await resolveUrl(logoImg);
    if (!url) continue;

    try {
      await new Promise(r => setTimeout(r, 200));
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const w = await sharp(buf).resize(128, 128, { fit: "contain" }).webp({ quality: 75 }).toBuffer();
      fs.writeFileSync(dest, w);
      ok++;
    } catch {}
    if ((i + 1) % 100 === 0) console.log(`  Logos: ${i + 1}/${items.length} — ${ok} OK`);
  }
  console.log(`  Logos: ✅ ${ok}/${items.length}`);
}

async function main() {
  const world = JSON.parse(fs.readFileSync("output/world.json", "utf-8"));
  const staffData = JSON.parse(fs.readFileSync("output/staff.json", "utf-8")).staff ?? [];

  // Players que NO tienen foto aún
  const pPending = world.players.filter((p: any) => p.photoId && !fs.existsSync(path.join(PP, `${p.photoId}.webp`)));
  await batch(PP, pPending, "Players", 256);

  const sPending = staffData.filter((s: any) => s.photoId && !fs.existsSync(path.join(SP, `${s.photoId}.webp`)));
  await batch(SP, sPending, "Staff", 256);

  await logos(world.teams);

  const count = (d: string) => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".webp")).length : 0;
  console.log("\n" + "=".repeat(50));
  console.log("RESUMEN FINAL");
  console.log(`  Players: ${count(PP)}`);
  console.log(`  Staff:   ${count(SP)}`);
  console.log(`  Logos:   ${count(LP)}`);
}

main().catch(console.error);
