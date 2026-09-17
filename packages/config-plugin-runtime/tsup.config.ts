import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  format: ["esm"],
  entry: ["src/index.ts"],
  external: ["@weaver/config-engine", "@weaver/config-types", "@ghost-shell/contracts"],
});
