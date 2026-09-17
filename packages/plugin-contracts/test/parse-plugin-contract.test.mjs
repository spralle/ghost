import assert from "node:assert/strict";
import test from "node:test";
import { evaluateShellPluginCompatibility } from "../../plugin-system/src/compatibility.ts";
import { composeEnabledPluginContributions, composeThemeContributions } from "../../plugin-system/src/composition.ts";
import {
  createDefaultContributionPredicateMatcher,
  evaluateContributionPredicate,
} from "../../plugin-system/src/predicate.ts";
import { buildActionSurface, dispatchAction, resolveMenuActions } from "../../shell/src/action-surface.ts";
import { parsePluginContract, parseTenantPluginManifest } from "../dist/index.js";

test("returns typed data for a valid plugin contract", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.valid",
      name: "Valid Plugin",
      version: "1.0.0",
    },
    contributes: {
      views: [
        {
          id: "valid.view",
          title: "Valid View",
          component: "ValidView",
        },
      ],
      parts: [
        {
          id: "valid.part",
          title: "Valid Part",
          dock: {
            container: "utility",
            order: 1,
          },
        },
      ],
      actions: [
        {
          id: "valid.action",
          title: "Run Valid",
          intent: "valid.run",
          when: {
            "demo.selection": "valid",
          },
        },
      ],
      menus: [
        {
          menu: "actionPalette",
          action: "valid.action",
          group: "navigation",
          order: 10,
        },
      ],
      keybindings: [
        {
          action: "valid.action",
          keybinding: "ctrl+shift+v",
        },
      ],
      selection: [
        {
          id: "valid.selection",
          receiverEntityType: "workbench.node",
          interests: [
            {
              sourceEntityType: "workbench.node",
            },
          ],
        },
      ],
      dragDropSessionReferences: [
        {
          type: "node",
          sessionId: "session-123",
        },
      ],
      popoutCapabilities: {
        allowPopout: true,
        allowMultiplePopouts: false,
      },
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.manifest.id, "ghost.valid");
    assert.equal(result.data.contributes?.parts?.[0]?.dock?.container, "utility");
  }
});

test("accepts the minimal sample contract-consumer plugin manifest", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.sample.contract-consumer",
      name: "Sample Contract Consumer",
      version: "0.1.0",
    },
    contributes: {
      views: [
        {
          id: "sample.view",
          title: "Sample View",
          component: "SampleView",
        },
      ],
    },
  });

  assert.equal(result.success, true);
});

test("returns structured errors for missing required manifest fields", () => {
  const result = parsePluginContract({
    manifest: {
      id: "",
      name: "Missing Version Plugin",
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(
      result.errors.some((error) => error.path === "manifest.id"),
      true,
    );
    assert.equal(
      result.errors.some((error) => error.path === "manifest.version"),
      true,
    );
  }
});

test("returns structured errors for invalid dock metadata fields", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.invalid-contrib",
      name: "Invalid Contribution Plugin",
      version: "1.0.0",
    },
    contributes: {
      parts: [
        {
          id: "part-1",
          title: "Part",
          dock: {
            order: "first",
          },
        },
      ],
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(
      result.errors.some((error) => error.path === "contributes.parts.0.dock.order"),
      true,
    );
  }
});

test("accepts capability declarations and explicit dependsOn requirements", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.capability-provider",
      name: "Capability Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        components: [
          {
            id: "ghost.component.map-panel",
            version: "1.2.0",
          },
        ],
        services: [
          {
            id: "ghost.service.route-planner",
            version: "2.0.0",
          },
        ],
      },
    },
    dependsOn: {
      plugins: [
        {
          pluginId: "ghost.base-runtime",
          versionRange: "^3.0.0",
        },
      ],
      components: [
        {
          id: "ghost.component.map-panel",
          versionRange: "^1.0.0",
        },
      ],
      services: [
        {
          id: "ghost.service.weather",
          versionRange: "~1.4.0",
          optional: true,
        },
      ],
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.contributes?.capabilities?.components?.[0]?.version, "1.2.0");
    assert.equal(result.data.dependsOn?.plugins?.[0]?.versionRange, "^3.0.0");
    assert.equal(result.data.dependsOn?.services?.[0]?.optional, true);
  }
});

test("rejects invalid capability and dependency declaration shapes", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.invalid-capability-deps",
      name: "Invalid Capability Deps",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        components: [
          {
            id: "ghost.component.map-panel",
            version: 42,
          },
        ],
      },
    },
    dependsOn: {
      plugins: [
        {
          pluginId: "ghost.base-runtime",
        },
      ],
      services: [
        {
          id: "ghost.service.weather",
          versionRange: "^1.0.0",
          optional: "sometimes",
        },
      ],
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(
      result.errors.some((error) => error.path === "contributes.capabilities.components.0.version"),
      true,
    );
    assert.equal(
      result.errors.some((error) => error.path === "dependsOn.plugins.0.versionRange"),
      true,
    );
    assert.equal(
      result.errors.some((error) => error.path === "dependsOn.services.0.optional"),
      true,
    );
  }
});

test("rejects unexpected top-level fields", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.extra-field",
      name: "Extra Field Plugin",
      version: "1.0.0",
    },
    unknown: true,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const hasUnexpectedFieldError = result.errors.some(
      (error) => error.path === "" && error.code === "unrecognized_keys",
    );
    assert.equal(hasUnexpectedFieldError, true);
  }
});

test("accepts actions/menu/keybindings for action surface", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.command-surface",
      name: "Command Surface Plugin",
      version: "1.0.0",
    },
    contributes: {
      actions: [
        {
          id: "surface.action",
          title: "Surface Action",
          intent: "surface.open",
        },
      ],
      menus: [
        {
          action: "surface.action",
          menu: "actionPalette",
        },
      ],
      keybindings: [
        {
          action: "surface.action",
          keybinding: "ctrl+shift+s",
        },
      ],
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.contributes?.actions?.[0]?.id, "surface.action");
  }
});

test("compatibility: major mismatch returns actionable reason", () => {
  const result = evaluateShellPluginCompatibility("^2.1.0", "^1.9.0");

  assert.equal(result.compatible, false);
  if (!result.compatible) {
    assert.equal(result.code, "MAJOR_MISMATCH");
    assert.match(result.message, /major versions/i);
  }
});

test("compatibility: minor-forward overlap is allowed", () => {
  const result = evaluateShellPluginCompatibility("^1.4.0", "^1.2.0");

  assert.equal(result.compatible, true);
  if (result.compatible) {
    assert.match(result.message, /semver-compatible/i);
  }
});

test("compatibility: exact and patch-safe range is allowed", () => {
  const result = evaluateShellPluginCompatibility("~1.2.0", "1.2.5");

  assert.equal(result.compatible, true);
});

test("tenant manifest parser accepts typed plugin descriptors", () => {
  const result = parseTenantPluginManifest({
    tenantId: "demo",
    plugins: [
      {
        id: "ghost.plugin-starter",
        version: "0.1.0",
        entry: "local://plugins/plugin-starter/src/index.ts",
        compatibility: {
          shell: "^1.0.0",
          pluginContract: "^1.0.0",
        },
      },
    ],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.plugins[0].compatibility.shell, "^1.0.0");
  }
});

test("tenant manifest parser reports nested field validation errors", () => {
  const result = parseTenantPluginManifest({
    tenantId: "demo",
    plugins: [
      {
        id: "ghost.plugin-starter",
        version: "0.1.0",
        entry: "local://plugins/plugin-starter/src/index.ts",
        compatibility: {
          shell: "",
        },
      },
    ],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(
      result.errors.some((error) => error.path === "plugins.0.compatibility.pluginContract"),
      true,
    );
    assert.equal(
      result.errors.some((error) => error.path === "plugins.0.compatibility.shell"),
      true,
    );
  }
});

test("composeEnabledPluginContributions composes parts from enabled plugin contracts only", () => {
  const composed = composeEnabledPluginContributions([
    {
      id: "ghost.domain.unplanned-orders",
      enabled: true,
      contract: {
        manifest: {
          id: "ghost.domain.unplanned-orders",
          name: "Unplanned Orders",
          version: "0.1.0",
        },
        contributes: {
          views: [
            {
              id: "domain.unplanned-orders.view",
              title: "Unplanned Orders",
              component: "UnplannedOrdersView",
            },
          ],
          parts: [
            {
              id: "domain.unplanned-orders.part",
              title: "Unplanned Orders",
              dock: {
                container: "workbench-main",
                order: 10,
              },
              component: "UnplannedOrdersPart",
            },
          ],
        },
      },
    },
    {
      id: "ghost.domain.vessel-view",
      enabled: true,
      contract: {
        manifest: {
          id: "ghost.domain.vessel-view",
          name: "Vessel View",
          version: "0.1.0",
        },
        contributes: {
          parts: [
            {
              id: "domain.vessel-view.part",
              title: "Vessel View",
              dock: {
                container: "workbench-secondary",
                order: 20,
              },
              component: "VesselViewPart",
            },
          ],
        },
      },
    },
    {
      id: "ghost.disabled-plugin",
      enabled: false,
      contract: {
        manifest: {
          id: "ghost.disabled-plugin",
          name: "Disabled",
          version: "0.1.0",
        },
        contributes: {
          parts: [
            {
              id: "disabled.part",
              title: "Disabled Part",
              dock: {
                container: "workbench-side",
                order: 30,
              },
              component: "DisabledPart",
            },
          ],
        },
      },
    },
  ]);

  assert.equal(composed.parts.length, 2);
  assert.deepEqual(
    composed.parts.map((part) => `${part.pluginId}:${part.id}:${part.dock?.container ?? "none"}`),
    [
      "ghost.domain.unplanned-orders:domain.unplanned-orders.part:workbench-main",
      "ghost.domain.vessel-view:domain.vessel-view.part:workbench-secondary",
    ],
  );
  assert.equal(composed.views.length, 1);
  assert.equal(composed.views[0].pluginId, "ghost.domain.unplanned-orders");
});

test("contribution predicate matcher supports deterministic operators", () => {
  const predicate = {
    mode: { $eq: "strict", $ne: "legacy" },
    status: { $in: ["open", "pending"] },
    rank: { $gt: 1, $gte: 2, $lt: 4, $lte: 3 },
    "meta.source": { $exists: true },
    category: { $nin: ["forbidden"] },
  };

  const facts = {
    mode: "strict",
    status: "open",
    rank: 2,
    meta: { source: "manual" },
    category: "safe",
  };

  const result = evaluateContributionPredicate(predicate, facts);
  assert.equal(result, true);
});

test("default contribution matcher traces failed predicates", () => {
  const matcher = createDefaultContributionPredicateMatcher();
  const evaluation = matcher.evaluate(
    {
      rank: { $gt: 10 },
      "target.vesselClass": "RORO",
    },
    {
      rank: 2,
      target: {
        vesselClass: "TANKER",
      },
    },
  );

  assert.equal(evaluation.matched, false);
  assert.equal(evaluation.failedPredicates.length, 2);
  assert.equal(evaluation.failedPredicates[0].path, "rank");
  assert.equal(evaluation.failedPredicates[1].path, "target.vesselClass");
});

test("evaluateContributionPredicate supports matcher boundary injection", () => {
  let calls = 0;
  const matcher = {
    id: "spec-adapter",
    evaluate(predicate, facts) {
      calls += 1;
      assert.equal(predicate.kind, "expected");
      assert.equal(facts.sourceType, "order");
      return {
        matched: true,
        failedPredicates: [],
      };
    },
  };

  const matched = evaluateContributionPredicate(
    {
      kind: "expected",
    },
    {
      sourceType: "order",
    },
    matcher,
  );

  assert.equal(matched, true);
  assert.equal(calls, 1);
});

test("action-surface dispatch predicate semantics stay in parity with default matcher", async () => {
  const cases = [
    {
      name: "nested path $eq",
      predicate: { "selection.kind": { $eq: "order" } },
      facts: { selection: { kind: "order" } },
    },
    {
      name: "$ne mismatch blocks dispatch",
      predicate: { mode: { $ne: "legacy" } },
      facts: { mode: "legacy" },
    },
    {
      name: "$in",
      predicate: { status: { $in: ["open", "pending"] } },
      facts: { status: "open" },
    },
    {
      name: "$nin",
      predicate: { status: { $nin: ["closed"] } },
      facts: { status: "open" },
    },
    {
      name: "$gt/$gte/$lt/$lte",
      predicate: { rank: { $gt: 1, $gte: 2, $lt: 4, $lte: 3 } },
      facts: { rank: 2 },
    },
    {
      name: "$exists false when key is present",
      predicate: { "meta.traceId": { $exists: false } },
      facts: { meta: { traceId: "present" } },
    },
  ];

  for (const testCase of cases) {
    let calls = 0;
    const runtime = {
      resolve(intent) {
        calls += 1;
        assert.equal(intent.type, "demo.run");
        return {
          kind: "executed",
        };
      },
    };

    const surface = buildActionSurface([
      {
        manifest: {
          id: "ghost.matcher-parity",
          name: "Matcher Parity",
          version: "1.0.0",
        },
        contributes: {
          actions: [
            {
              id: "demo.action",
              title: "Run",
              intent: "demo.run",
              when: testCase.predicate,
            },
          ],
        },
      },
    ]);

    const expected = evaluateContributionPredicate(testCase.predicate, testCase.facts);
    const actual = await dispatchAction(surface, runtime, "demo.action", testCase.facts);

    assert.equal(actual, expected, `dispatch parity failed for ${testCase.name}`);
    assert.equal(calls, expected ? 1 : 0, `dispatch invocation parity failed for ${testCase.name}`);
  }
});

test("action-surface menu and keybinding predicate semantics match default matcher", () => {
  const cases = [
    {
      name: "nested path lookup",
      when: { "target.vesselClass": "RORO" },
      facts: { target: { vesselClass: "RORO" } },
    },
    {
      name: "$exists with missing nested path",
      when: { "target.operator": { $exists: false } },
      facts: { target: { vesselClass: "RORO" } },
    },
    {
      name: "combined operator mismatch",
      when: { priority: { $gte: 2, $lt: 5 }, status: { $in: ["open"] } },
      facts: { priority: 1, status: "open" },
    },
  ];

  for (const testCase of cases) {
    const surface = buildActionSurface([
      {
        manifest: {
          id: "ghost.surface-parity",
          name: "Surface Parity",
          version: "1.0.0",
        },
        contributes: {
          actions: [
            {
              id: "surface.action",
              title: "Surface Action",
              intent: "surface.run",
            },
          ],
          menus: [
            {
              menu: "actionPalette",
              action: "surface.action",
              when: testCase.when,
            },
          ],
          keybindings: [
            {
              action: "surface.action",
              keybinding: "ctrl+shift+s",
              when: testCase.when,
            },
          ],
        },
      },
    ]);

    const expected = evaluateContributionPredicate(testCase.when, testCase.facts);

    const resolvedMenu = resolveMenuActions(surface, "actionPalette", testCase.facts);
    assert.equal(resolvedMenu.length > 0, expected, `menu parity failed for ${testCase.name}`);
  }
});

// ---------------------------------------------------------------------------
// Theme, branding, and activationEvents contract tests (armada-5q4)
// ---------------------------------------------------------------------------

test("accepts a plugin contract with contributes.themes", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.theme.dark-ocean",
      name: "Dark Ocean Theme",
      version: "1.0.0",
    },
    contributes: {
      themes: [
        {
          id: "dark-ocean",
          name: "Dark Ocean",
          mode: "dark",
          palette: {
            background: "#1a1b26",
            foreground: "#c0caf5",
            accent: "#7aa2f7",
          },
          backgrounds: [{ url: "/assets/ocean.png", mode: "cover" }],
          fonts: {
            body: "Inter",
            mono: "JetBrains Mono",
          },
          terminal: {
            color0: "#15161e",
            color1: "#f7768e",
          },
          preview: "https://example.com/dark-ocean-preview.png",
        },
      ],
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.contributes?.themes?.[0]?.id, "dark-ocean");
    assert.equal(result.data.contributes?.themes?.[0]?.mode, "dark");
    assert.equal(result.data.contributes?.themes?.[0]?.palette.background, "#1a1b26");
    assert.equal(result.data.contributes?.themes?.[0]?.fonts?.body, "Inter");
  }
});

test("accepts a plugin contract with contributes.branding", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.branding.acme",
      name: "ACME Branding",
      version: "1.0.0",
    },
    contributes: {
      branding: {
        appName: "ACME Portal",
        logo: {
          light: "/assets/logo-light.svg",
          dark: "/assets/logo-dark.svg",
        },
        favicon: "/assets/favicon.ico",
        loadingScreen: {
          logo: "/assets/loading-logo.svg",
          backgroundColor: "#ffffff",
        },
      },
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.contributes?.branding?.appName, "ACME Portal");
    assert.equal(result.data.contributes?.branding?.logo?.light, "/assets/logo-light.svg");
    assert.equal(result.data.contributes?.branding?.loadingScreen?.backgroundColor, "#ffffff");
  }
});

test("accepts a plugin contract with activationEvents: ['onStartup']", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.theme.eager",
      name: "Eager Theme",
      version: "1.0.0",
    },
    activationEvents: ["onStartup"],
    contributes: {
      themes: [
        {
          id: "eager-light",
          name: "Eager Light",
          mode: "light",
          palette: {
            background: "#ffffff",
            foreground: "#1a1a1a",
            primary: "#0066cc",
          },
        },
      ],
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.activationEvents, ["onStartup"]);
  }
});

test("rejects unknown keys in theme contribution (strict mode)", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.theme.strict-test",
      name: "Strict Theme",
      version: "1.0.0",
    },
    contributes: {
      themes: [
        {
          id: "strict",
          name: "Strict",
          mode: "dark",
          palette: {
            background: "#000000",
            foreground: "#ffffff",
            accent: "#ff0000",
          },
          unknownField: "should-fail",
        },
      ],
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const hasUnrecognized = result.errors.some((error) => error.code === "unrecognized_keys");
    assert.equal(hasUnrecognized, true);
  }
});

test("rejects unknown keys in branding contribution (strict mode)", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.branding.strict-test",
      name: "Strict Branding",
      version: "1.0.0",
    },
    contributes: {
      branding: {
        appName: "Test",
        extraField: "should-fail",
      },
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const hasUnrecognized = result.errors.some((error) => error.code === "unrecognized_keys");
    assert.equal(hasUnrecognized, true);
  }
});

test("rejects invalid activationEvent string", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.theme.bad-event",
      name: "Bad Event",
      version: "1.0.0",
    },
    activationEvents: ["onStartup", "onFileOpen"],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const hasEventError = result.errors.some((error) => error.path.startsWith("activationEvents"));
    assert.equal(hasEventError, true);
  }
});

test("composeThemeContributions merges themes from multiple plugins with pluginId tagging", () => {
  const composed = composeThemeContributions([
    {
      pluginId: "ghost.theme.ocean",
      contract: {
        manifest: { id: "ghost.theme.ocean", name: "Ocean", version: "1.0.0" },
        contributes: {
          themes: [
            {
              id: "ocean-dark",
              name: "Ocean Dark",
              mode: "dark",
              palette: {
                background: "#1a1b26",
                foreground: "#c0caf5",
                accent: "#7aa2f7",
              },
            },
            {
              id: "ocean-light",
              name: "Ocean Light",
              mode: "light",
              palette: {
                background: "#ffffff",
                foreground: "#1a1a1a",
                primary: "#0066cc",
              },
            },
          ],
        },
      },
    },
    {
      pluginId: "ghost.theme.forest",
      contract: {
        manifest: { id: "ghost.theme.forest", name: "Forest", version: "1.0.0" },
        contributes: {
          themes: [
            {
              id: "forest-dark",
              name: "Forest Dark",
              mode: "dark",
              palette: {
                background: "#1a2e1a",
                foreground: "#c5e1c5",
                accent: "#4caf50",
              },
            },
          ],
        },
      },
    },
    {
      pluginId: "ghost.no-themes",
      contract: {
        manifest: { id: "ghost.no-themes", name: "No Themes", version: "1.0.0" },
      },
    },
  ]);

  assert.equal(composed.length, 3);
  assert.deepEqual(
    composed.map((t) => `${t.pluginId}:${t.id}`),
    ["ghost.theme.ocean:ocean-dark", "ghost.theme.ocean:ocean-light", "ghost.theme.forest:forest-dark"],
  );
  assert.equal(composed[0].mode, "dark");
  assert.equal(composed[1].mode, "light");
  assert.equal(composed[2].palette.accent, "#4caf50");
});

// ---------------------------------------------------------------------------
// Plugin manifest gallery: icon + screenshots (armada-4q5)
// ---------------------------------------------------------------------------

test("accepts a plugin contract with manifest.icon", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.plugin.with-icon",
      name: "Plugin With Icon",
      version: "1.0.0",
      icon: "https://cdn.example.com/icons/plugin.png",
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.manifest.icon, "https://cdn.example.com/icons/plugin.png");
  }
});

test("accepts a plugin contract with manifest.gallery.screenshots", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.plugin.with-gallery",
      name: "Plugin With Gallery",
      version: "1.0.0",
      gallery: {
        screenshots: ["https://cdn.example.com/screenshots/1.png", "https://cdn.example.com/screenshots/2.png"],
      },
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.manifest.gallery?.screenshots?.length, 2);
    assert.equal(result.data.manifest.gallery?.screenshots?.[0], "https://cdn.example.com/screenshots/1.png");
  }
});

test("accepts a plugin contract with manifest.gallery.banner", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.plugin.with-banner",
      name: "Plugin With Banner",
      version: "1.0.0",
      gallery: {
        banner: {
          color: "#1a1b26",
          theme: "dark",
        },
      },
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.manifest.gallery?.banner?.color, "#1a1b26");
    assert.equal(result.data.manifest.gallery?.banner?.theme, "dark");
  }
});

test("rejects unknown keys in gallery (strict mode)", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.plugin.strict-gallery",
      name: "Strict Gallery Plugin",
      version: "1.0.0",
      gallery: {
        screenshots: [],
        unknownGalleryField: "should-fail",
      },
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const hasUnrecognized = result.errors.some((error) => error.code === "unrecognized_keys");
    assert.equal(hasUnrecognized, true);
  }
});

test("existing contracts without icon/gallery still validate", () => {
  const result = parsePluginContract({
    manifest: {
      id: "ghost.legacy.plugin",
      name: "Legacy Plugin",
      version: "2.0.0",
    },
    contributes: {
      views: [
        {
          id: "legacy.view",
          title: "Legacy View",
          component: "LegacyView",
        },
      ],
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.manifest.icon, undefined);
    assert.equal(result.data.manifest.gallery, undefined);
  }
});
