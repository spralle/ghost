#!/usr/bin/env node
// Schema registry build script — discovers, composes, and generates config schema artifacts

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectConfigurationDeclarations } from "./config-declarations.mjs";
import { discoverViewConfigs } from "./discover-config.mjs";

const PLUGIN_DIRS = ["plugins", "apps"];

/**
 * Build configuration schema artifacts from plugin declarations.
 * @param {{ repoRoot: string, outputDir: string, scanDirs?: string[] }} options
 */
export async function buildConfigSchemas(options) {
  const { repoRoot, outputDir, scanDirs = PLUGIN_DIRS } = options;

  const { composeConfigurationSchemas, generateJsonSchema, generateZodSchemaSource } = await import(
    "@weaver/config-engine"
  );

  const declarations = await collectConfigurationDeclarations(repoRoot, scanDirs);

  // Discover view configs for informational reporting only.
  const viewConfigDirs = scanDirs.map((d) => join(repoRoot, d));
  const viewConfigs = await discoverViewConfigs(viewConfigDirs);

  const composed = composeConfigurationSchemas(declarations);
  if (composed.errors.length > 0) {
    return {
      schemaCount: composed.schemas.size,
      viewConfigCount: viewConfigs.length,
      errors: composed.errors,
    };
  }

  const jsonSchema = generateJsonSchema(composed.schemas);
  const zodSource = generateZodSchemaSource(composed.schemas);

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "config-schema.json"), `${JSON.stringify(jsonSchema, null, 2)}\n`);
  await writeFile(join(outputDir, "config-schemas.generated.ts"), zodSource);

  return {
    schemaCount: composed.schemas.size,
    viewConfigCount: viewConfigs.length,
    errors: [],
  };
}

// CLI entry point
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  const repoRoot = resolve(__dirname, "..");
  const outputDir = join(repoRoot, "dist");

  buildConfigSchemas({ repoRoot, outputDir })
    .then((result) => {
      if (result.errors.length > 0) {
        console.error("[build-config-schemas] Composition errors:");
        for (const err of result.errors) {
          console.error(`  - [${err.type}] ${err.message}`);
        }
        process.exitCode = 1;
        return;
      }
      console.log(`[build-config-schemas] OK: ${result.schemaCount} schema(s) composed.`);
      if (result.viewConfigCount > 0) {
        console.log(`  View configs discovered: ${result.viewConfigCount}`);
      }
    })
    .catch((error) => {
      console.error("[build-config-schemas] Build failed:", error);
      process.exitCode = 1;
    });
}
