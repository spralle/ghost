import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  entry: {
    index: "src/index.ts",
    path: "src/path.entry.ts",
    transforms: "src/transforms.entry.ts",
    validation: "src/validation.entry.ts",
  },
  splitting: true,
});
