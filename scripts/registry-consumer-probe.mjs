import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot, validateReleaseInventory } from "./release-inventory.mjs";
import { nonRegistrySpecKind } from "./release-layout.mjs";

const dependencySections = ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"];

function allDependencyEdges(manifest) {
  return dependencySections.flatMap((section) =>
    Object.entries(manifest[section] ?? {}).map(([name, spec]) => ({ section, name, spec })),
  );
}

export async function inspectRegistryReadiness() {
  const { entries, inventory, manifestsByName } = await validateReleaseInventory();
  const rootManifest = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
  const manifests = [{ path: ".", manifest: rootManifest }, ...entries];
  const blockers = [];
  for (const { path, manifest } of manifests) {
    for (const edge of allDependencyEdges(manifest)) {
      const kind = nonRegistrySpecKind(edge.spec);
      if (!kind || manifestsByName.has(edge.name)) continue;
      blockers.push({ workspace: path, package: manifest.name, ...edge, kind });
    }
  }
  blockers.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    schemaVersion: 1,
    issue: inventory.registryHoldIssue,
    status: blockers.length === 0 ? "ready" : "external_hold",
    registryReady: blockers.length === 0,
    blockerCount: blockers.length,
    blockers,
  };
}

async function main() {
  const report = await inspectRegistryReadiness();
  const reportPath = process.env.GHOST_REGISTRY_REPORT ?? "/tmp/opencode/ghost-registry-probe.json";
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const reportSha256 = createHash("sha256")
    .update(await readFile(reportPath))
    .digest("hex");
  process.stdout.write(`${JSON.stringify({ ...report, reportPath, reportSha256 }, null, 2)}\n`);
  if (!report.registryReady) {
    console.error(`REGISTRY_BLOCKED ${report.issue}: ${report.blockerCount} non-registry dependency edges`);
    process.exitCode = 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
