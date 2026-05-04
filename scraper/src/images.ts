/** Image URL resolution and download pipeline */
import fs from "fs";
import path from "path";
import { apiGet } from "./api";
import { RATE_LIMIT, PHOTOS_DIR } from "./config";

interface ImageInfo {
  url: string;
  width: number;
  height: number;
  size: number;
}

/** Resolve a wiki image filename to a CDN URL */
export async function resolveImageUrl(filename: string): Promise<string | null> {
  try {
    const safeFile = filename.replace(/ /g, "_");
    const json = await apiGet({
      action: "query",
      titles: `File:${safeFile}`,
      prop: "imageinfo",
      iiprop: "url|size|mime",
    });

    const pages = json.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    if (page?.imageinfo?.[0]?.url) {
      return page.imageinfo[0].url;
    }
    return null;
  } catch {
    return null;
  }
}

/** Discover player image from parse output (prop=images) */
export function findPlayerImage(images: string[]): string | null {
  // Priority: main player photo (not champion squares, not logos)
  for (const img of images) {
    const name = img.toLowerCase();
    // Skip champion squares and logos
    if (name.endsWith("square.png")) continue;
    if (name.includes("logo")) continue;
    if (name.includes("icon")) continue;
    if (name.endsWith("std.png")) continue;
    // Accept jpg or png
    if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png")) {
      return img;
    }
  }
  // Fallback: accept anything that's an image
  for (const img of images) {
    if (img.match(/\.(jpg|jpeg|png|webp)$/i) && !img.match(/square\.png$/i)) {
      return img;
    }
  }
  return null;
}

/** Download an image from CDN */
export async function downloadImage(url: string, destPath: string): Promise<Buffer | null> {
  if (fs.existsSync(destPath)) {
    return fs.readFileSync(destPath);
  }

  const delay = RATE_LIMIT.imageDelay;
  await new Promise((resolve) => setTimeout(resolve, delay));

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "OLManager-Scraper/0.1" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(destPath, buffer);
    return buffer;
  } catch {
    return null;
  }
}

/** Convert image to WebP using sharp */
export async function convertToWebp(
  buffer: Buffer,
  outputPath: string,
  size: number = 256,
  quality: number = 80,
): Promise<Buffer | null> {
  if (fs.existsSync(outputPath)) {
    return fs.readFileSync(outputPath);
  }

  try {
    const sharp = (await import("sharp")).default;
    const webp = await sharp(buffer)
      .resize(size, size, { fit: "cover", position: "center" })
      .webp({ quality })
      .toBuffer();

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, webp);
    return webp;
  } catch (err) {
    console.warn(`  ⚠️  sharp failed: ${err}`);
    // Fallback: just save the original
    fs.writeFileSync(outputPath, buffer);
    return buffer;
  }
}
