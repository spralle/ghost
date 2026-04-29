import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: "ghost.settings-panel",
      filename: "remoteEntry.js",
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginParts": "./src/plugin-parts.ts",
      },
      shared: {
        "@ghost-shell/contracts": {
          singleton: true,
          requiredVersion: "^0.0.0",
        },
        "@ghost-shell/react": {
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
        "react/jsx-runtime": {
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
    port: 4182,
    strictPort: true,
    cors: true,
  },
});