#!/usr/bin/env node
// CI validation script — checks changePolicy assignments against security conventions

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectConfigurationDeclarations } from "./config-declarations.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const PLUGIN_DIRS = ["plugins", "apps"];

async function main() {
  const { composeConfigurationSchemas } = await import("@weaver/config-engine");
  const { validateChangePolicies } = await import("@weaver/config-policy");
  const declarations = await collectConfigurationDeclarations(repoRoot, PLUGIN_DIRS);

  const composed = composeConfigurationSchemas(declarations);
  const violations = validateChangePolicies(composed.schemas);

  if (violations.length === 0) {
    console.log(`[change-policy] OK: ${composed.schemas.size} schema(s) validated.`);
    return;
  }

  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");

  if (warnings.length > 0) {
    console.warn("[change-policy] Warnings:");
    for (const w of warnings) {
      console.warn(`  - ${w.violation} (suggest: ${w.suggestedPolicy ?? "review"})`);
    }
  }

  if (errors.length > 0) {
    console.error("[change-policy] Errors:");
    for (const e of errors) {
      console.error(`  - ${e.violation} (suggest: ${e.suggestedPolicy ?? "review"})`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[change-policy] Validation failed:", error);
  process.exitCode = 1;
});
