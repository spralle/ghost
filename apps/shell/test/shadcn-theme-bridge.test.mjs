import assert from "node:assert/strict";
import test from "node:test";
import { parsePluginContract } from "../../../packages/plugin-contracts/dist/index.js";
import { GHOST_THEME_CSS_VARS } from "../../../packages/theme/src/index.ts";
import { GHOST_TO_SHADCN_MAP } from "../../../plugins/shadcn-theme-bridge-plugin/src/bridge-mapping.ts";
import { pluginContract } from "../../../plugins/shadcn-theme-bridge-plugin/src/plugin-contract-expose.ts";

// ---------------------------------------------------------------------------
// Expected shadcn variable names (all 29 that shadcn/ui components use)
// ---------------------------------------------------------------------------

const EXPECTED_SHADCN_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--radius",
];

// ---------------------------------------------------------------------------
// 1. Bridge mapping covers all 29 shadcn variables
// ---------------------------------------------------------------------------

test("GHOST_TO_SHADCN_MAP covers all expected shadcn variables", () => {
  const shadcnVars = GHOST_TO_SHADCN_MAP.map(([, shadcn]) => shadcn);

  for (const expected of EXPECTED_SHADCN_VARS) {
    assert.ok(shadcnVars.includes(expected), `Missing shadcn variable: ${expected}`);
  }
});

// ---------------------------------------------------------------------------
// 2. Plugin contract validates via parsePluginContract
// ---------------------------------------------------------------------------

test("shadcn theme bridge plugin contract validates", () => {
  const result = parsePluginContract(pluginContract);

  assert.equal(result.success, true, "Plugin contract must be valid");
  if (result.success) {
    assert.equal(result.data.manifest.id, "ghost.shadcn.theme-bridge");
    assert.equal(result.data.manifest.name, "shadcn Theme Bridge");
    assert.deepEqual(result.data.activationEvents, ["onStartup"]);

    const services = result.data.contributes?.capabilities?.services;
    assert.ok(services, "capabilities.services must be defined");
    assert.equal(services.length, 1);
    assert.equal(services[0].id, "ghost.shadcn.theme-bridge");
  }
});

// ---------------------------------------------------------------------------
// 3. No duplicate mappings
// ---------------------------------------------------------------------------

test("GHOST_TO_SHADCN_MAP has no duplicate ghost source variables", () => {
  const ghostVars = GHOST_TO_SHADCN_MAP.map(([ghost]) => ghost);
  const unique = new Set(ghostVars);

  assert.equal(
    unique.size,
    ghostVars.length,
    `Found duplicate ghost source variables: ${ghostVars.filter((v, i) => ghostVars.indexOf(v) !== i).join(", ")}`,
  );
});

test("GHOST_TO_SHADCN_MAP has no duplicate shadcn target variables", () => {
  const shadcnVars = GHOST_TO_SHADCN_MAP.map(([, shadcn]) => shadcn);
  const unique = new Set(shadcnVars);

  assert.equal(
    unique.size,
    shadcnVars.length,
    `Found duplicate shadcn target variables: ${shadcnVars.filter((v, i) => shadcnVars.indexOf(v) !== i).join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// 4. All Ghost source variables exist in GHOST_THEME_CSS_VARS
// ---------------------------------------------------------------------------

test("all Ghost source variables in bridge mapping exist in GHOST_THEME_CSS_VARS", () => {
  const validGhostVars = new Set(Object.values(GHOST_THEME_CSS_VARS));

  for (const [ghostVar] of GHOST_TO_SHADCN_MAP) {
    assert.ok(
      validGhostVars.has(ghostVar),
      `Ghost variable '${ghostVar}' is not in GHOST_THEME_CSS_VARS. Valid variables: ${[...validGhostVars].join(", ")}`,
    );
  }
});
