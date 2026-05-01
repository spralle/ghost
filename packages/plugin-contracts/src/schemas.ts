import { z } from "zod";

import { partialThemePaletteSchema, terminalPaletteSchema } from "./theme-types.js";

/** Configuration property schema validator (JSON Schema subset). */
const configurationPropertySchemaSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z
    .object({
      type: z.union([z.string(), z.array(z.string()).readonly()]).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      default: z.unknown().optional(),
      enum: z.array(z.unknown()).readonly().optional(),
      format: z.string().optional(),
      pattern: z.string().optional(),
      properties: z.record(z.string(), configurationPropertySchemaSchema).optional(),
      items: z
        .union([configurationPropertySchemaSchema, z.array(configurationPropertySchemaSchema).readonly()])
        .optional(),
      oneOf: z.array(configurationPropertySchemaSchema).readonly().optional(),
      anyOf: z.array(configurationPropertySchemaSchema).readonly().optional(),
    })
    .passthrough(),
);

const nonEmptyString = z.string().trim().min(1);

export const pluginGalleryBannerSchema = z
  .object({
    color: z.string().optional(),
    theme: z.enum(["dark", "light"]).optional(),
  })
  .strict();

export const pluginGallerySchema = z
  .object({
    screenshots: z.array(z.string()).optional(),
    banner: pluginGalleryBannerSchema.optional(),
  })
  .strict();

export const pluginManifestIdentitySchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    version: nonEmptyString,
    icon: z.string().optional(),
    gallery: pluginGallerySchema.optional(),
  })
  .strict();

export const pluginViewContributionSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    component: nonEmptyString,
  })
  .strict();

export const pluginPartContributionSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    component: nonEmptyString.optional(),
    dock: z
      .object({
        container: nonEmptyString.optional(),
        order: z.number().finite().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const pluginCapabilityComponentContributionSchema = z
  .object({
    id: nonEmptyString,
    version: nonEmptyString,
  })
  .strict();

export const pluginCapabilityServiceContributionSchema = z
  .object({
    id: nonEmptyString,
    version: nonEmptyString,
  })
  .strict();

export const pluginProvidedCapabilitiesSchema = z
  .object({
    components: z.array(pluginCapabilityComponentContributionSchema).optional(),
    services: z.array(pluginCapabilityServiceContributionSchema).optional(),
  })
  .strict();

export const pluginDependencyPluginRequirementSchema = z
  .object({
    pluginId: nonEmptyString,
    versionRange: nonEmptyString,
  })
  .strict();

export const pluginDependencyComponentRequirementSchema = z
  .object({
    id: nonEmptyString,
    versionRange: nonEmptyString,
    optional: z.boolean().optional(),
  })
  .strict();

export const pluginDependencyServiceRequirementSchema = z
  .object({
    id: nonEmptyString,
    versionRange: nonEmptyString,
    optional: z.boolean().optional(),
  })
  .strict();

export const pluginDependenciesSchema = z
  .object({
    plugins: z.array(pluginDependencyPluginRequirementSchema).optional(),
    components: z.array(pluginDependencyComponentRequirementSchema).optional(),
    services: z.array(pluginDependencyServiceRequirementSchema).optional(),
  })
  .strict();

const pluginContributionPredicateSchema = z.record(z.string(), z.unknown());

export const pluginActionContributionSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    intent: nonEmptyString,
    when: pluginContributionPredicateSchema.optional(),
  })
  .strict();

export const pluginMenuContributionSchema = z
  .object({
    menu: nonEmptyString,
    action: nonEmptyString,
    group: nonEmptyString.optional(),
    order: z.number().int().optional(),
    when: pluginContributionPredicateSchema.optional(),
  })
  .strict();

export const pluginKeybindingContributionSchema = z
  .object({
    action: nonEmptyString,
    keybinding: nonEmptyString,
    when: pluginContributionPredicateSchema.optional(),
  })
  .strict();

export const pluginSelectionContributionSchema = z
  .object({
    id: nonEmptyString,
    receiverEntityType: nonEmptyString,
    interests: z.array(
      z
        .object({
          sourceEntityType: nonEmptyString,
          adapter: nonEmptyString.optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const pluginDerivedLaneContributionSchema = z
  .object({
    id: nonEmptyString,
    key: nonEmptyString,
    sourceEntityType: nonEmptyString,
    scope: z.enum(["global", "group"]),
    valueType: z.enum(["entity-id", "entity-id-list"]),
    strategy: z.enum(["priority-id", "joined-selected-ids"]),
  })
  .strict();

export const pluginDragDropSessionReferenceSchema = z
  .object({
    type: nonEmptyString,
    sessionId: nonEmptyString,
  })
  .strict();

export const pluginPopoutCapabilityFlagsSchema = z
  .object({
    allowPopout: z.boolean().optional(),
    allowMultiplePopouts: z.boolean().optional(),
  })
  .strict();

export const themeContributionSchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    author: z.string().optional(),
    mode: z.enum(["dark", "light"]),
    palette: partialThemePaletteSchema,
    backgrounds: z
      .array(
        z
          .object({
            url: nonEmptyString,
            mode: z.enum(["cover", "contain", "tile"]).optional(),
          })
          .strict(),
      )
      .optional(),
    fonts: z
      .object({
        body: z.string().optional(),
        mono: z.string().optional(),
        heading: z.string().optional(),
      })
      .strict()
      .optional(),
    terminal: terminalPaletteSchema.optional(),
    preview: z.string().optional(),
  })
  .strict();

export const brandingContributionSchema = z
  .object({
    appName: z.string().optional(),
    logo: z
      .object({
        light: z.string().optional(),
        dark: z.string().optional(),
      })
      .strict()
      .optional(),
    favicon: z.string().optional(),
    loadingScreen: z
      .object({
        logo: z.string().optional(),
        backgroundColor: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const activationRuleSchema = z.object({
  entry: z.string(),
  when: z.record(z.unknown()),
});

export const activationsSchema = z.array(activationRuleSchema);

export type ActivationRule = z.infer<typeof activationRuleSchema>;

export const activationEventsSchema = z.array(z.enum(["onStartup"]));

export const pluginConfigurationContributionSchema = z
  .object({
    type: z.union([z.string(), z.array(z.string()).readonly()]).optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    properties: z.record(z.string(), configurationPropertySchemaSchema),
  })
  .passthrough();

export const shellEdgeSlotSchema = z.enum(["top", "bottom", "left", "right"]);

export const shellEdgeSlotPositionSchema = z.enum(["start", "center", "end"]);

export const pluginSlotContributionSchema = z
  .object({
    id: z.string().min(1),
    slot: shellEdgeSlotSchema,
    position: shellEdgeSlotPositionSchema,
    order: z.number().int(),
    component: z.string().min(1),
  })
  .strict();

export const pluginSectionContributionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    target: z.string().min(1),
    order: z.number().int(),
    component: z.string().min(1),
  })
  .strict();

const focusGrabConfigSchema = z
  .object({
    backdrop: z.union([z.boolean(), z.string()]).optional(),
    dismissOnOutsideClick: z.boolean().optional(),
  })
  .strict();

const autoStackConfigSchema = z
  .object({
    direction: z.enum(["up", "down", "left", "right"]),
    gap: z.number().finite(),
  })
  .strict();

export const pluginLayerSurfaceContributionSchema = z
  .object({
    id: nonEmptyString,
    component: nonEmptyString,
    layer: nonEmptyString,
    anchor: z.number().int(),
    size: z
      .object({
        width: z.union([z.number(), z.string()]).optional(),
        height: z.union([z.number(), z.string()]).optional(),
      })
      .strict()
      .optional(),
    margin: z
      .object({
        top: z.number().optional(),
        right: z.number().optional(),
        bottom: z.number().optional(),
        left: z.number().optional(),
      })
      .strict()
      .optional(),
    exclusiveZone: z.number().optional(),
    keyboardInteractivity: z.enum(["none", "on_demand", "exclusive"]).optional(),
    inputBehavior: z.enum(["opaque", "passthrough", "content_aware"]).optional(),
    focusGrab: focusGrabConfigSchema.optional(),
    opacity: z.number().min(0).max(1).optional(),
    backdropFilter: z.string().optional(),
    autoStack: autoStackConfigSchema.optional(),
    sessionLock: z.boolean().optional(),
    order: z.number().optional(),
    when: z.string().optional(),
  })
  .strict();

export const pluginLayerDefinitionSchema = z
  .object({
    name: nonEmptyString,
    zOrder: z.number().int(),
    defaultKeyboard: z.enum(["none", "on_demand", "exclusive"]).optional(),
    defaultPointer: z.enum(["opaque", "passthrough", "content_aware"]).optional(),
    supportsSessionLock: z.boolean().optional(),
  })
  .strict();

export const pluginContributionsSchema = z
  .object({
    views: z.array(pluginViewContributionSchema).optional(),
    parts: z.array(pluginPartContributionSchema).optional(),
    capabilities: pluginProvidedCapabilitiesSchema.optional(),
    actions: z.array(pluginActionContributionSchema).optional(),
    menus: z.array(pluginMenuContributionSchema).optional(),
    keybindings: z.array(pluginKeybindingContributionSchema).optional(),
    selection: z.array(pluginSelectionContributionSchema).optional(),
    derivedLanes: z.array(pluginDerivedLaneContributionSchema).optional(),
    dragDropSessionReferences: z.array(pluginDragDropSessionReferenceSchema).optional(),
    popoutCapabilities: pluginPopoutCapabilityFlagsSchema.optional(),
    themes: z.array(themeContributionSchema).optional(),
    branding: brandingContributionSchema.optional(),
    configuration: pluginConfigurationContributionSchema.optional(),
    slots: z.array(pluginSlotContributionSchema).optional(),
    sections: z.array(pluginSectionContributionSchema).optional(),
    layers: z.array(pluginLayerDefinitionSchema).optional(),
    layerSurfaces: z.array(pluginLayerSurfaceContributionSchema).optional(),
  })
  .strict();

export const pluginContractSchema = z
  .object({
    manifest: pluginManifestIdentitySchema,
    contributes: pluginContributionsSchema.optional(),
    dependsOn: pluginDependenciesSchema.optional(),
    activationEvents: activationEventsSchema.optional(),
    activations: activationsSchema.optional(),
  })
  .strict();

export const pluginCompatibilityMetadataSchema = z
  .object({
    shell: nonEmptyString,
    pluginContract: nonEmptyString,
  })
  .strict();

export const tenantPluginDescriptorSchema = z
  .object({
    id: nonEmptyString,
    version: nonEmptyString,
    entry: nonEmptyString,
    compatibility: pluginCompatibilityMetadataSchema,
    pluginDependencies: z.array(nonEmptyString).optional(),
  })
  .strict();

export const tenantPluginManifestResponseSchema = z
  .object({
    tenantId: nonEmptyString,
    plugins: z.array(tenantPluginDescriptorSchema),
  })
  .strict();
