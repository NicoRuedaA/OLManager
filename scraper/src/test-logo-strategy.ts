#!/usr/bin/env tsx
/** Test rápido: validar que .infobox-image img funciona en Leaguepedia */
import fs from "fs";

const UA = "OLManager/0.1 (test; contact via GitHub)";

const teams = [
  // Equipos principales activos
  { name: "T1", expected: "debería existir" },
  { name: "G2 Esports", expected: "debería existir" },
  { name: "Karmine Corp", expected: "debería existir" },
  // Equipos con nombres potencialmente problemáticos
  { name: "GIANTX", expected: "puede no existir → probar Giantx" },
  { name: "SK Gaming", expected: "debería existir" },
];

async function getPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

function extractInfoboxImage(html: string): string | null {
  // Buscar .infobox-image img (clásica estructura MediaWiki)
  const infoboxMatch = html.match(
    /<td\s+class="infobox-image"[^>]*>.*?<img\s+[^>]*src="([^"]+)"[^>]*\/?\s*>/is
  );
  if (infoboxMatch) return infoboxMatch[1];

  // Fallback: buscar cualquier img dentro de infobox
  const fallbackMatch = html.match(
    /class="infobox[^"]*"[^>]*>.*?<img\s+[^>]*src="([^"]+)"[^>]*\/?\s*>/is
  );
  if (fallbackMatch) return fallbackMatch[1];

  return null;
}

function normalizeUrl(src: string): string {
  if (src.startsWith("//")) return "https:" + src;
  if (src.startsWith("/")) return "https://lol.fandom.com" + src;
  return src;
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 Validación: .infobox-image img en Leaguepedia");
  console.log("=".repeat(60));

  for (const team of teams) {
    const slug = team.name.replace(/ /g, "_");
    const url = `https://lol.fandom.com/wiki/${slug}`;

    console.log(`\n📌 ${team.name}`);
    console.log(`   URL: ${url}`);
    console.log(`   Expectativa: ${team.expected}`);

    const html = await getPage(url);
    if (!html) {
      console.log(`   ❌ No se pudo obtener la página (HTTP error o timeout)`);
      continue;
    }

    const src = extractInfoboxImage(html);
    if (src) {
      const fullUrl = normalizeUrl(src);
      console.log(`   ✅ Logo encontrado: ${fullUrl}`);

      // Verificar que la URL funciona
      const imgRes = await fetch(fullUrl, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        console.log(`   ✅ Imagen descargable: ${buf.length} bytes (${imgRes.headers.get("content-type")})`);
      } else {
        console.log(`   ❌ Imagen NO descargable: HTTP ${imgRes.status}`);
      }
    } else {
      console.log(`   ❌ No se encontró .infobox-image img`);
      // Debug: buscar pistas en el HTML
      const hasInfobox = html.includes("infobox");
      const hasLogoImg = html.includes("logo") && html.includes("img");
      console.log(`   🐛 Pistas: infobox=${hasInfobox}, logo+img=${hasLogoImg}`);
      
      // Buscar cualquier imagen que pueda ser el logo
      const allImgs = html.match(/<img[^>]+src="([^"]+)"[^>]*>/g);
      if (allImgs) {
        const firstFew = allImgs.slice(0, 5);
        console.log(`   📸 Primeras ${firstFew.length} imágenes en la página:`);
        firstFew.forEach((img, i) => {
          const srcMatch = img.match(/src="([^"]+)"/);
          if (srcMatch) console.log(`      ${i + 1}. ${srcMatch[1].slice(0, 100)}`);
        });
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🏁 Test completo");
}

main().catch(console.error);
