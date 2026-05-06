#!/usr/bin/env tsx
/** Download ALL team logos by parsing page images */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const LP = "output/team-logos";
if (!fs.existsSync(LP)) fs.mkdirSync(LP, { recursive: true });

const API = "https://lol.fandom.com/api.php";
const UA = "OLManager/0.1";
let lastReq = 0;

async function api(params: Record<string, string>): Promise<any> {
  const wait = 500 - (Date.now() - lastReq);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReq = Date.now();
  const url = new URL(API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  return res.json();
}

async function tryUrl(filename: string): Promise<string | null> {
  try {
    const j: any = await api({ action: "query", titles: `File:${filename.replace(/ /g, "_")}`, prop: "imageinfo", iiprop: "url" });
    const p = Object.values(j.query?.pages ?? {})[0] as any;
    if (p?.imageinfo?.[0]?.url && !p.missing) return p.imageinfo[0].url;
  } catch {}
  return null;
}

async function getTeamImages(teamName: string): Promise<string[]> {
  try {
    const j: any = await api({ action: "parse", page: teamName, prop: "images", format: "json" });
    return j.parse?.images ?? [];
  } catch { return []; }
}

async function main() {
  const world = JSON.parse(fs.readFileSync("output/world.json", "utf-8"));
  const missing = world.teams.filter((t: any) => {
    const s = t.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return !fs.existsSync(path.join(LP, `${s}.webp`));
  });

  console.log(`Faltan logos para ${missing.length} equipos`);
  let ok = 0;

  for (let i = 0; i < missing.length; i++) {
    const t = missing[i];
    const safe = t.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const dest = path.join(LP, `${safe}.webp`);

    const imgs = await getTeamImages(t.name);
    
    // Find best logo candidate
    const filtered = imgs.filter((img: string) => {
      const n = img.toLowerCase();
      // Skip champion squares, player photos, infobox icons
      if (n.includes("square.png") && !n.includes("logo")) return false;
      if (n.includes("player") || n.includes("champion")) return false;
      if (n.startsWith("infobox_")) return false;
      return n.endsWith(".png") || n.endsWith(".jpg");
    });

    // Priority: contains "logo" or contains team name
    const nameParts = t.name.toLowerCase().split(/\s+/);
    filtered.sort((a: string, b: string) => {
      const al = a.toLowerCase(), bl = b.toLowerCase();
      const aScore = (al.includes("logo") ? 2 : 0) + (nameParts.some((w: string) => w.length > 2 && al.includes(w)) ? 1 : 0);
      const bScore = (bl.includes("logo") ? 2 : 0) + (nameParts.some((w: string) => w.length > 2 && bl.includes(w)) ? 1 : 0);
      return bScore - aScore;
    });

    let found = false;
    for (const img of filtered.slice(0, 3)) {
      const url = await tryUrl(img);
      if (url) {
        await new Promise(r => setTimeout(r, 200));
        try {
          const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const w = await sharp(buf).resize(128, 128, { fit: "contain" }).webp({ quality: 75 }).toBuffer();
            fs.writeFileSync(dest, w);
            ok++;
            found = true;
            console.log(`  ✓ ${t.name} → ${img}`);
            break;
          }
        } catch {}
      }
    }
    if (!found) console.log(`  ✗ ${t.name} — sin logo`);

    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${missing.length} — ${ok} nuevos logos`);
  }

  const total = fs.readdirSync(LP).filter(f => f.endsWith(".webp")).length;
  console.log(`\n✅ Total: ${total}/${world.teams.length} logos (${ok} nuevos)`);
}

main().catch(console.error);
