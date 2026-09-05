import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  server: {
    watch: {
      // The codebase knowledge graph is regenerated while Codex inspects the
      // project. Those generated database writes must not reload the editor.
      ignored: ["**/.codebase-memory/**"],
    },
  },
});
