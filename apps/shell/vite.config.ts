import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SHELL_DEV_PORT = 5173;
const BACKEND_DEV_PORT = 8787;
const PLUGIN_CONTRACTS_SRC = fileURLToPath(new URL("../../packages/plugin-contracts/src", import.meta.url));
const PREDICATE_SRC_ROOT = fileURLToPath(new URL("../../packages/predicate/src", import.meta.url));
const PREDICATE_SOURCE = fileURLToPath(new URL("../../packages/predicate/src/index.ts", import.meta.url));
const UI_SOURCE = fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url));
const UI_SRC_ROOT = fileURLToPath(new URL("../../packages/ui/src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Subpath alias must come before root alias for correct matching order
      "@ghost-shell/contracts/": `${PLUGIN_CONTRACTS_SRC}/`,
      "@ghost-shell/contracts": `${PLUGIN_CONTRACTS_SRC}/index.ts`,
      "@ghost-shell/predicate/": `${PREDICATE_SRC_ROOT}/`,
      "@ghost-shell/predicate": PREDICATE_SOURCE,
      "@ghost-shell/ui": UI_SOURCE,
      // Mirror the UI package's tsconfig path mapping so that its internal
      // `@/lib/utils` imports resolve when the shell consumes raw source.
      "@/": `${UI_SRC_ROOT}/`,
    },
  },
  server: {
    host: "127.0.0.1",
    port: SHELL_DEV_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${BACKEND_DEV_PORT}`,
        changeOrigin: true,
      },
    },
  },
});