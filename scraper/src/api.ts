/** API client with rate limiting, retry, and on-disk cache */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { API_URL, USER_AGENT, RATE_LIMIT, CACHE_DIR } from "./config";

interface ApiResponse {
  [key: string]: any;
}

let lastRequestTime = 0;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHash("md5").update(sorted).digest("hex").slice(0, 12);
}

function cachePath(key: string): string {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  return path.join(CACHE_DIR, `${key}.json`);
}

function readCache(key: string): ApiResponse | null {
  const p = cachePath(key);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    // Cache for 24 hours
    if (Date.now() - data._cachedAt < 24 * 60 * 60 * 1000) {
      return data;
    }
  } catch {}
  return null;
}

function writeCache(key: string, data: ApiResponse): void {
  fs.writeFileSync(cachePath(key), JSON.stringify({ ...data, _cachedAt: Date.now() }, null, 2));
}

/**
 * Make a rate-limited API request with retry and caching.
 */
export async function apiGet(params: Record<string, string>, skipCache = false): Promise<ApiResponse> {
  const key = cacheKey(params);

  if (!skipCache) {
    const cached = readCache(key);
    if (cached) return cached;
  }

  const url = new URL(API_URL);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  // Rate limiting
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT.apiDelay) {
    await delay(RATE_LIMIT.apiDelay - elapsed);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RATE_LIMIT.maxRetries; attempt++) {
    try {
      lastRequestTime = Date.now();
      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      const json = await res.json() as ApiResponse;

      if (json.error) {
        // Rate limited — wait longer
        if (json.error.code === "ratelimited") {
          console.warn(`  ⏳ Rate limited, waiting ${(attempt + 1) * 5}s...`);
          await delay((attempt + 1) * 5000);
          continue;
        }
        throw new Error(`API error: ${json.error.code} — ${json.error.info}`);
      }

      writeCache(key, json);
      return json;
    } catch (err: any) {
      lastError = err;
      if (attempt < RATE_LIMIT.maxRetries - 1) {
        const wait = RATE_LIMIT.backoffMultiplier ** attempt * 1000;
        await delay(wait);
      }
    }
  }

  throw lastError ?? new Error("Max retries exhausted");
}

/** Clear all cached API responses */
export function clearCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    for (const file of fs.readdirSync(CACHE_DIR)) {
      if (file.endsWith(".json")) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
    }
  }
}
