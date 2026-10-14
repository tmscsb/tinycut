import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";

function commitHash(): string {
  // Cloudflare Pages exposes the deployed commit; fall back to local git.
  const fromEnv = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

const appVersion = `${new Date().toISOString().slice(0, 10)}-${commitHash()}`;

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    watch: {
      // The codebase knowledge graph is regenerated while Codex inspects the
      // project. Those generated database writes must not reload the editor.
      ignored: ["**/.codebase-memory/**"],
    },
  },
});
