import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { testCandidatePattern, testRunnerConfig } from "./test-runner-config.mjs";

const GENERATED_PATH_PARTS = ["/node_modules/", "/dist/", "/dist-test/"];
const RUNNER_MARKERS = {
  node: /^\s*import\s+[^;\n]+\s+from\s+["']node:test["']/m,
  vitest: /^\s*import\s+[^;\n]+\s+from\s+["']vitest["']/m,
  bun: /^\s*import\s+[^;\n]+\s+from\s+["']bun:test["']/m,
};

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function assertCanonicalPattern(pattern) {
  const normalized = `/${normalizePath(pattern)}`;
  if (GENERATED_PATH_PARTS.some((part) => normalized.includes(part))) {
    throw new Error(`Runner selection contains a generated path: ${pattern}`);
  }
}

function resolveLaneFiles(lane, config, cwd) {
  const selected = [];
  for (const pattern of config.patterns) {
    assertCanonicalPattern(pattern);
    const matches = globSync(pattern, { cwd, exclude: ["**/node_modules/**", "**/dist/**", "**/dist-test/**"] });
    if (matches.length === 0) throw new Error(`${lane} runner pattern matched no files: ${pattern}`);
    selected.push(...matches.map(normalizePath));
  }

  const excluded = new Set(config.excludedFiles.map(normalizePath));
  for (const file of excluded) assertCanonicalPattern(file);
  return selected.filter((file) => !excluded.has(file));
}

function assertNoDuplicates(selections) {
  const owners = new Map();
  for (const [lane, files] of Object.entries(selections)) {
    for (const file of files) {
      const owner = owners.get(file);
      if (owner) throw new Error(`Test file is owned by both ${owner} and ${lane}: ${file}`);
      owners.set(file, lane);
    }
  }
}

export function classifyTestSource(source) {
  const lanes = Object.entries(RUNNER_MARKERS)
    .filter(([, marker]) => marker.test(source))
    .map(([lane]) => lane);
  if (lanes.length !== 1) throw new Error(`Expected exactly one runner import, found: ${lanes.join(", ") || "none"}`);
  return lanes[0];
}

function assertSourceOwnership(selections, cwd) {
  const candidates = globSync(testCandidatePattern, {
    cwd,
    exclude: ["**/node_modules/**", "**/dist/**", "**/dist-test/**"],
  }).map(normalizePath);
  const owners = new Map(Object.entries(selections).flatMap(([lane, files]) => files.map((file) => [file, lane])));

  for (const file of candidates) {
    const declaredOwner = classifyTestSource(readFileSync(resolve(cwd, file), "utf8"));
    const selectedOwner = owners.get(file);
    if (selectedOwner !== declaredOwner) {
      throw new Error(
        `Test ownership mismatch for ${file}: imported ${declaredOwner}, selected ${selectedOwner ?? "none"}`,
      );
    }
  }

  if (owners.size !== candidates.length) {
    throw new Error(`Runner selections contain ${owners.size} files but discovery found ${candidates.length}`);
  }
}

export function resolveRunnerSelections(config = testRunnerConfig, cwd = process.cwd()) {
  const selections = Object.fromEntries(
    Object.entries(config).map(([lane, laneConfig]) => [lane, resolveLaneFiles(lane, laneConfig, cwd)]),
  );
  assertNoDuplicates(selections);
  assertSourceOwnership(selections, cwd);
  return selections;
}
