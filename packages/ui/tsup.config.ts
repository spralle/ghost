import { copyFile, mkdir } from "node:fs/promises";
import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  format: ["esm"],
  entry: ["src/index.ts"],
  async onSuccess() {
    await mkdir("dist", { recursive: true });
    await Promise.all([
      copyFile("src/styles/globals.css", "dist/globals.css"),
      copyFile("src/styles/theme.css", "dist/theme.css"),
    ]);
  },
});
