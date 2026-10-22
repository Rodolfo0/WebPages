import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";

import { sites } from "@openai/sites-vite-plugin";
import tailwindcss from "@tailwindcss/postcss";

import hostingConfig from "./.openai/hosting.json";

const LOCAL_D1_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async ({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const databaseId = process.env.D1_DATABASE_ID || fileEnv.D1_DATABASE_ID;

  if (d1 && mode === "production" && !databaseId) {
    throw new Error(
      "D1_DATABASE_ID is required for production builds. Set it in the GitHub Actions production environment or in .env.production.local.",
    );
  }

  const localBindingConfig = {
    name: "site-creator",
    compatibility_date: "2026-10-13",
    main: "vinext/server/app-router-entry",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: d1
      ? [
          {
            binding: d1,
            database_name: "site-creator-d1",
            database_id: databaseId || LOCAL_D1_DATABASE_ID,
            migrations_dir: "database/d1/migrations",
            remote: process.env.D1_REMOTE === "true",
          },
        ]
      : [],
    r2_buckets: r2
      ? [
          {
            binding: r2,
            bucket_name: "site-creator-r2",
          },
        ]
      : [],
  };

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        // Browser tests do not need DevTools; Miniflare's inspector binds to
        // all interfaces, which is unavailable in some local test sandboxes.
        inspectorPort: mode === "test" ? false : undefined,
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
