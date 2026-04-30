import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["source"],
  },
  plugins: [
    federation({
      name: "ghost.theme.default",
      filename: "remoteEntry.js",
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
      },
      shared: {
        "@ghost-shell/contracts": {
          singleton: true,
          requiredVersion: "^0.0.0",
        },
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 4176,
    strictPort: true,
    cors: true,
  },
});
