import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["source"],
  },
  plugins: [
    federation({
      name: "ghost.domain.vessel-view",
      filename: "remoteEntry.js",
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginParts": "./src/plugin-parts.ts",
        "./pluginComponents": "./src/plugin-components-expose.ts",
        "./pluginServices": "./src/plugin-services-expose.ts",
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
    port: 4174,
    strictPort: true,
    cors: true,
  },
});
