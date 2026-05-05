import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const resolve = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@scheman\/core$/, replacement: resolve("../../packages/scheman-core/src/index.ts") },
      {
        find: /^@ghost-shell\/table-from-schema$/,
        replacement: resolve("../../packages/table-from-schema/src/index.ts"),
      },
      { find: /^@ghost-shell\/entity-table$/, replacement: resolve("../../packages/entity-table/src/index.ts") },
      { find: /^@ghost-shell\/data-table$/, replacement: resolve("../../packages/data-table/src/index.ts") },
      { find: /^@ghost-shell\/ui$/, replacement: resolve("../../packages/ui/src/index.ts") },
      { find: /^@ghost-shell\/contracts$/, replacement: resolve("../../packages/plugin-contracts/src/index.ts") },
      { find: /^@\//, replacement: resolve("../../packages/ui/src") + "/" },
    ],
  },
  server: { port: 5175, host: true },
});
