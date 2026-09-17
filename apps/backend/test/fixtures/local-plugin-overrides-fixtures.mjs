export const LOCAL_PLUGIN_IDS = Object.freeze({
  actionPalette: "ghost.action-palette",
  appearanceSettings: "ghost.appearance-settings",
  domainUnplannedOrders: "ghost.domain.unplanned-orders",
  domainVesselView: "ghost.domain.vessel-view",
  exampleLayerAnchorShowcase: "ghost.example-layer-anchor-showcase",
  exampleLayerBackground: "ghost.example-layer-background",
  exampleLayerCustom: "ghost.example-layer-custom",
  exampleLayerModal: "ghost.example-layer-modal",
  exampleLayerNotification: "ghost.example-layer-notification",
  exampleLayerOverlay: "ghost.example-layer-overlay",
  exampleLayerPanel: "ghost.example-layer-panel",
  groupContext: "ghost.group-context",
  keybindings: "ghost.keybindings",
  motion: "ghost.motion",
  pendingChordIndicator: "ghost.pending-chord-indicator",
  pluginStarter: "ghost.plugin-starter",
  pluginsPanel: "ghost.plugins-panel",
  settingsPanel: "ghost.settings-panel",
  sharedUiCapabilities: "ghost.shared.ui-capabilities",
  sampleContractConsumer: "ghost.sample.contract-consumer",
  shadcnThemeBridge: "ghost.shadcn.theme-bridge",
  themeDefault: "ghost.theme.default",
  topbarWidgets: "ghost.topbar-widgets",
  ui: "ghost.ui",
  viewPicker: "ghost.view-picker",
});

const LOCAL_PLUGIN_PORTS = Object.freeze({
  [LOCAL_PLUGIN_IDS.actionPalette]: 4171,
  [LOCAL_PLUGIN_IDS.appearanceSettings]: 4172,
  [LOCAL_PLUGIN_IDS.domainUnplannedOrders]: 4173,
  [LOCAL_PLUGIN_IDS.domainVesselView]: 4174,
  [LOCAL_PLUGIN_IDS.exampleLayerAnchorShowcase]: 4175,
  [LOCAL_PLUGIN_IDS.exampleLayerBackground]: 4176,
  [LOCAL_PLUGIN_IDS.exampleLayerCustom]: 4177,
  [LOCAL_PLUGIN_IDS.exampleLayerModal]: 4178,
  [LOCAL_PLUGIN_IDS.exampleLayerNotification]: 4179,
  [LOCAL_PLUGIN_IDS.exampleLayerOverlay]: 4180,
  [LOCAL_PLUGIN_IDS.exampleLayerPanel]: 4181,
  [LOCAL_PLUGIN_IDS.groupContext]: 4184,
  [LOCAL_PLUGIN_IDS.keybindings]: 4185,
  [LOCAL_PLUGIN_IDS.motion]: 4182,
  [LOCAL_PLUGIN_IDS.pendingChordIndicator]: 4186,
  [LOCAL_PLUGIN_IDS.pluginStarter]: 4187,
  [LOCAL_PLUGIN_IDS.pluginsPanel]: 4188,
  [LOCAL_PLUGIN_IDS.sampleContractConsumer]: 4189,
  [LOCAL_PLUGIN_IDS.settingsPanel]: 4190,
  [LOCAL_PLUGIN_IDS.shadcnThemeBridge]: 4191,
  [LOCAL_PLUGIN_IDS.sharedUiCapabilities]: 4192,
  [LOCAL_PLUGIN_IDS.themeDefault]: 4193,
  [LOCAL_PLUGIN_IDS.topbarWidgets]: 4194,
  [LOCAL_PLUGIN_IDS.ui]: 4183,
  [LOCAL_PLUGIN_IDS.viewPicker]: 4195,
});

export const SORTED_LOCAL_PLUGIN_IDS = Object.freeze(Object.keys(LOCAL_PLUGIN_PORTS).sort());

export const DEFAULT_LOCAL_PLUGIN_ENTRIES = Object.freeze(
  Object.fromEntries(
    Object.entries(LOCAL_PLUGIN_PORTS).map(([pluginId, port]) => [
      pluginId,
      `http://127.0.0.1:${port}/mf-manifest.json`,
    ]),
  ),
);

export const DEFAULT_GATEWAY_PORT = 41337;

export const DEFAULT_GATEWAY_PLUGIN_ENTRIES = Object.freeze(
  Object.fromEntries(
    SORTED_LOCAL_PLUGIN_IDS.map((pluginId) => [
      pluginId,
      `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/${pluginId}/mf-manifest.json`,
    ]),
  ),
);

export function buildEntryOverrideMap(overrides) {
  return new Map(Object.entries(overrides));
}
