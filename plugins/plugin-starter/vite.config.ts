import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["source"],
  },
  plugins: [
    federation({
      name: "ghost.plugin-starter",
      filename: "remoteEntry.js",
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginParts": "./src/plugin-parts-expose.ts",
        "./pluginComponents": "./src/plugin-components-expose.ts",
        "./pluginServices": "./src/plugin-services-expose.ts",
      },
      shared: {
        "@ghost-shell/contracts": {
          singleton: true,
          requiredVersion: "^0.0.0",
        },
        "@ghost-shell/ui": {
          singleton: true,
          import: false,
          requiredVersion: "^0.0.0",
        },
        react: {
          singleton: true,
          import: false,
          requiredVersion: "^18.3.1",
        },
        "react-dom": {
          singleton: true,
          import: false,
          requiredVersion: "^18.3.1",
        },
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 4171,
    strictPort: true,
    cors: true,
  },
});
