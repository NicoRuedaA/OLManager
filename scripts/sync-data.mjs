// Cross-platform replacement for the previous PowerShell-only beforeBuildCommand.
// Mirrors the project-root `data/` directory into `src-tauri/data/` so the Tauri
// bundler can pick it up as a resource. Runs on Windows, macOS and Linux.
import { existsSync, rmSync, cpSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "data");
const dest = resolve(root, "src-tauri", "data");

if (!existsSync(src)) {
  console.error(`[sync-data] source directory not found: ${src}`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[sync-data] copied ${src} -> ${dest}`);
