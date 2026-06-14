import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
) as { version: string };

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

function manualChunks(id: string): string | undefined {
  if (id.indexOf("node_modules") === -1) {
    return undefined;
  }

  if (id.indexOf("react-router-dom") !== -1) {
    return "router";
  }

  if (
    id.indexOf("react") !== -1 ||
    id.indexOf("react-dom") !== -1 ||
    id.indexOf("scheduler") !== -1
  ) {
    return "react-vendor";
  }

  if (id.indexOf("@tauri-apps") !== -1) {
    return "tauri";
  }

  if (id.indexOf("i18next") !== -1) {
    return "i18n";
  }

  if (id.indexOf("lucide-react") !== -1) {
    return "icons";
  }

  return undefined;
}

// https://vite.dev/config/
export default defineConfig(async () => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "es-toolkit-mjs",
        resolveId(id) {
          if (!id.startsWith("es-toolkit/compat/")) return;
          const name = id.replace("es-toolkit/compat/", "");
          for (const dir of ["object", "array", "function", "predicate", "string", "math", "util"]) {
            const mjs = path.resolve(__dirname, "node_modules", "es-toolkit", "dist", "compat", dir, name + ".mjs");
            if (existsSync(mjs)) return mjs;
          }
        },
        transform(code, id) {
          if (!id.includes("es-toolkit") || !id.endsWith(".mjs")) return;
          const name = path.basename(id, ".mjs");
          if (!name || code.includes("export default")) return;
          if (code.includes(`export { ${name} }`)) {
            return code + `\nexport default ${name};`;
          }
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["src/test-setup.ts"],
      coverage: {
        exclude: ["src/i18n/locales/**", "src/**/*.test.{ts,tsx}", "src/test-setup.ts"],
      },
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    optimizeDeps: {
      exclude: ["es-toolkit"],
    },
    clearScreen: false,
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri`, and the data/photo dirs
        //    the importer writes into — otherwise a bulk import (~1800 photos)
        //    streaming into publicDir triggers a full-reload storm that blanks
        //    the page. These are server-owned assets, not part of the module
        //    graph, so there's nothing to hot-reload anyway.
        ignored: [
          "**/src-tauri/**",
          "**/public/player-photos/**",
          "**/public/teams-icons/**",
          "**/public/competitions-icons/**",
          "**/public/staff-photos/**",
          "**/data/**",
        ],
      },
    },
  };
});
