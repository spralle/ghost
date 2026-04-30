import { describe, it, expect } from "vitest";

/**
 * Integration test verifying the full pipeline from plugin configuration
 * declaration (new full JSON Schema format with relative keys) through
 * the schema bridge to what the settings panel would receive.
 */

import { collectPluginSchemaDeclarations } from "../plugin-schema-bridge";
import type { PluginConfigInput } from "../plugin-schema-bridge";

describe("plugin-schema-bridge new shape integration", () => {
  describe("theme-service builtin contract", () => {
    const themeServicePlugin: PluginConfigInput = {
      pluginId: "@ghost-shell/theme-service",
      configuration: {
        type: "object",
        properties: {
          activeThemeId: {
            type: "string",
            title: "Active Theme",
            description: "The currently active theme identifier",
            default: "ghost-dark",
          },
          autoDetectSystemTheme: {
            type: "boolean",
            title: "Auto-detect System Theme",
            description: "Automatically switch theme based on OS preference",
            default: true,
          },
        },
        required: ["activeThemeId"],
      },
    };

    it("extracts properties from full JSON Schema configuration", () => {
      const declarations = collectPluginSchemaDeclarations([themeServicePlugin]);

      expect(declarations).toHaveLength(1);
      expect(declarations[0].ownerId).toBe("@ghost-shell/theme-service");
      expect(declarations[0].properties).toHaveProperty("activeThemeId");
      expect(declarations[0].properties).toHaveProperty("autoDetectSystemTheme");
    });

    it("derives correct namespace from scoped plugin ID", () => {
      const declarations = collectPluginSchemaDeclarations([themeServicePlugin]);

      // @ghost-shell/theme-service → ghostShell.themeService
      expect(declarations[0].namespace).toBe("ghostShell.themeService");
    });

    it("relative keys would qualify to full paths", () => {
      const declarations = collectPluginSchemaDeclarations([themeServicePlugin]);
      const namespace = declarations[0].namespace;
      const relativeKeys = Object.keys(declarations[0].properties);

      const qualifiedKeys = relativeKeys.map((key) => `${namespace}.${key}`);
      expect(qualifiedKeys).toContain("ghostShell.themeService.activeThemeId");
      expect(qualifiedKeys).toContain("ghostShell.themeService.autoDetectSystemTheme");
    });
  });

  describe("ghost-motion-plugin contract", () => {
    const motionPlugin: PluginConfigInput = {
      pluginId: "@ghost-shell/ghost-motion-plugin",
      configuration: {
        type: "object",
        properties: {
          enableAnimations: {
            type: "boolean",
            title: "Enable Animations",
            description: "Toggle all motion animations",
            default: true,
          },
          reducedMotion: {
            type: "string",
            title: "Reduced Motion",
            description: "Reduced motion preference",
            enum: ["auto", "always", "never"],
            default: "auto",
          },
          transitionDuration: {
            type: "number",
            title: "Transition Duration",
            description: "Base transition duration in milliseconds",
            default: 200,
            minimum: 0,
            maximum: 2000,
          },
        },
      },
    };

    it("extracts all properties from motion plugin schema", () => {
      const declarations = collectPluginSchemaDeclarations([motionPlugin]);

      expect(declarations).toHaveLength(1);
      expect(Object.keys(declarations[0].properties)).toEqual([
        "enableAnimations",
        "reducedMotion",
        "transitionDuration",
      ]);
    });

    it("strips -plugin suffix in namespace derivation", () => {
      const declarations = collectPluginSchemaDeclarations([motionPlugin]);

      // @ghost-shell/ghost-motion-plugin → ghostShell.ghostMotion
      expect(declarations[0].namespace).toBe("ghostShell.ghostMotion");
    });

    it("preserves schema metadata on properties", () => {
      const declarations = collectPluginSchemaDeclarations([motionPlugin]);
      const props = declarations[0].properties as Record<string, { enum?: string[]; minimum?: number }>;

      expect(props.reducedMotion.enum).toEqual(["auto", "always", "never"]);
      expect(props.transitionDuration.minimum).toBe(0);
      expect(props.transitionDuration.maximum).toBe(2000);
    });
  });

  describe("end-to-end pipeline", () => {
    it("skips plugins without configuration", () => {
      const plugins: PluginConfigInput[] = [
        { pluginId: "no-config-plugin" },
        { pluginId: "empty-config", configuration: { type: "object" } },
        {
          pluginId: "@ghost-shell/theme-service",
          configuration: {
            type: "object",
            properties: { activeThemeId: { type: "string", default: "dark" } },
          },
        },
      ];

      const declarations = collectPluginSchemaDeclarations(plugins);

      // First has no configuration, second has no properties
      expect(declarations).toHaveLength(1);
      expect(declarations[0].ownerId).toBe("@ghost-shell/theme-service");
    });

    it("handles multiple plugins producing independent declarations", () => {
      const plugins: PluginConfigInput[] = [
        {
          pluginId: "@ghost-shell/theme-service",
          configuration: {
            type: "object",
            properties: { activeThemeId: { type: "string" } },
          },
        },
        {
          pluginId: "@ghost-shell/ghost-motion-plugin",
          configuration: {
            type: "object",
            properties: { enableAnimations: { type: "boolean" } },
          },
        },
      ];

      const declarations = collectPluginSchemaDeclarations(plugins);

      expect(declarations).toHaveLength(2);
      expect(declarations[0].namespace).toBe("ghostShell.themeService");
      expect(declarations[1].namespace).toBe("ghostShell.ghostMotion");
    });

    it("dot-separated plugin IDs derive camelCase namespaces", () => {
      const plugins: PluginConfigInput[] = [
        {
          pluginId: "ghost-shell.editor-core",
          configuration: {
            type: "object",
            properties: { tabSize: { type: "number", default: 2 } },
          },
        },
      ];

      const declarations = collectPluginSchemaDeclarations(plugins);

      expect(declarations[0].namespace).toBe("ghostShell.editorCore");
    });
  });
});
