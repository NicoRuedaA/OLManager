import { normalizeChampionKey } from "./champions/championIds";
import { assetUrl } from "./assetUrl";

type Normalize = "champion" | "slug";

function asset(path: string): string;
function asset(path: string | null | undefined, normalize?: Normalize): string | null;
function asset(path: string | null | undefined, normalize?: Normalize): string | null {
  if (path == null) return null;

  if (normalize) {
    const parts = path.split("/");
    const lastIdx = parts.length - 1;
    const extIdx = parts[lastIdx].lastIndexOf(".");
    const name = extIdx > 0 ? parts[lastIdx].slice(0, extIdx) : parts[lastIdx];
    const ext = extIdx > 0 ? parts[lastIdx].slice(extIdx) : "";

    let normalized: string | null = null;
    if (normalize === "champion") {
      normalized = normalizeChampionKey(name);
    } else if (normalize === "slug") {
      normalized = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }
    if (!normalized) return null;

    parts[lastIdx] = normalized + ext;
    return assetUrl(parts.join("/"));
  }

  return assetUrl(path);
}

export { type Normalize, asset };
