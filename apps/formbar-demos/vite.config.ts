import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const resolve = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@ghost\/ui$/, replacement: resolve("../../packages/ui/src/index.ts") },
      { find: /^@ghost\/plugin-contracts$/, replacement: resolve("../../packages/plugin-contracts/src/index.ts") },
      { find: /^@\//, replacement: `${resolve("../../packages/ui/src")}/` },
    ],
  },
  server: { port: 5174, host: "127.0.0.1" },
});
