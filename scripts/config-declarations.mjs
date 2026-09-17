import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { deriveContractFromPackageJson } from "@weaver/config-engine";
import { configurationPropertySchemaSchema } from "@weaver/config-types";

function readConfiguration(packageJson) {
  return (
    packageJson.ghost?.configuration ??
    packageJson.ghost?.contributes?.configuration ??
    packageJson.contributes?.configuration
  );
}

function readProperties(configuration) {
  if (typeof configuration !== "object" || configuration === null || Array.isArray(configuration)) return null;
  const properties = configuration.properties ?? configuration;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) return null;
  return properties;
}

function validateProperties(properties, packageName) {
  const validated = {};
  for (const [key, value] of Object.entries(properties)) {
    const parsed = configurationPropertySchemaSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(`Invalid configuration schema '${key}' in ${packageName}: ${parsed.error.message}`);
    }
    validated[key] = parsed.data;
  }
  return validated;
}

async function readPackageDeclarations(scanRoot) {
  const declarations = [];
  let entries;
  try {
    entries = await readdir(scanRoot, { withFileTypes: true });
  } catch {
    return declarations;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packagePath = join(scanRoot, entry.name, "package.json");
    let packageJson;
    try {
      packageJson = JSON.parse(await readFile(packagePath, "utf8"));
    } catch {
      continue;
    }
    const properties = readProperties(readConfiguration(packageJson));
    if (!properties || Object.keys(properties).length === 0) continue;
    const contract = deriveContractFromPackageJson(packageJson);
    declarations.push({
      ownerId: contract.pluginId,
      namespace: contract.namespace,
      properties: validateProperties(properties, packageJson.name),
    });
  }
  return declarations;
}

export async function collectConfigurationDeclarations(repoRoot, scanDirs = ["plugins", "apps"]) {
  const declarations = [];
  for (const directory of scanDirs) {
    declarations.push(...(await readPackageDeclarations(join(repoRoot, directory))));
  }
  return declarations;
}
