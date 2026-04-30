import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["source"],
  },
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: "ghost.shared.ui-capabilities",
      filename: "remoteEntry.js",
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginComponents": "./src/plugin-components.ts",
        "./pluginServices": "./src/plugin-services.ts",
        "./pluginParts": "./src/plugin-parts.ts",
      },
      shared: {
        "@ghost-shell/contracts": {
          singleton: true,
          import: false,
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
        "react-dom/client": {
          singleton: true,
          import: false,
          requiredVersion: "^18.3.1",
        },
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
    cors: true,
  },
});
