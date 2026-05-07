#!/usr/bin/env tsx
/** Reintento para equipos que fallaron */
const UA = "OLManager/0.1 (test)";

function extractInfoboxImage(html: string): string | null {
  const m = html.match(
    /<td\s+class="infobox-image"[^>]*>.*?<img\s+[^>]*src="([^"]+)"[^>]*\/?\s*>/is
  );
  if (m) return m[1];

  // Fallback: infobox sin td
  const m2 = html.match(
    /class="infobox[^"]*"[^>]*>.*?<img\s+[^>]*src="([^"]+)"[^>]*\/?\s*>/is
  );
  return m2 ? m2[1] : null;
}

async function test(team: string, slug: string) {
  const url = `https://lol.fandom.com/wiki/${slug}`;
  console.log(`\n📌 ${team} → ${url}`);
  
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.log(`   ❌ HTTP ${res.status}`);
      return;
    }
    const html = await res.text();
    const src = extractInfoboxImage(html);
    if (src) {
      const full = src.startsWith("//") ? "https:" + src : src;
      console.log(`   ✅ Logo: ${full}`);
      
      const img = await fetch(full, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      if (img.ok) {
        const buf = Buffer.from(await img.arrayBuffer());
        console.log(`   ✅ Descargable: ${buf.length} bytes (${img.headers.get("content-type")})`);
      } else {
        console.log(`   ❌ No descargable: HTTP ${img.status}`);
      }
    } else {
      console.log(`   ❌ No se encontró infobox-image img`);
      // Debug: buscar pistas
      const hasInfobox = html.includes('infobox');
      const hasImage = html.includes('infobox-image');
      const allImgs = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)];
      console.log(`   🐛 infobox=${hasInfobox} infobox-image=${hasImage} total-imgs=${allImgs.length}`);
      allImgs.slice(0, 3).forEach((m, i) => console.log(`   img[${i}]: ${m[1].slice(0, 120)}`));
    }
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }
}

async function main() {
  const teams = [
    { name: "T1", slug: "T1" },
    { name: "Karmine Corp", slug: "Karmine_Corp" },
    { name: "SK Gaming", slug: "SK_Gaming" },
    { name: "Fnatic", slug: "Fnatic" },
    { name: "MAD Lions KOI", slug: "MAD_Lions_KOI" },
    { name: "Movistar KOI", slug: "Movistar_KOI" },
    { name: "BDS Academy", slug: "BDS_Academy" },
    { name: "GIANTX", slug: "GIANTX" },
    { name: "Giantx", slug: "Giantx" },
    { name: "Giantx LEC", slug: "Giantx_LEC" },
  ];

  for (const t of teams) {
    await new Promise(r => setTimeout(r, 2500));
    await test(t.name, t.slug);
  }

  console.log("\n🏁 Done");
}

main().catch(console.error);
