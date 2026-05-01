import "./styles/tailwind.css";
import { defineReactParts } from "@ghost-shell/react";
import { ConfigTreeInspector } from "./components/config-tree-inspector.js";
import { PluginConfigBrowser } from "./components/plugin-config-browser.js";
import { pluginContract } from "./plugin-contract-expose.js";

export const parts = defineReactParts(pluginContract, {
  "ghost.shell.settings": PluginConfigBrowser,
  "ghost.shell.settings.diagnostics": ConfigTreeInspector,
});
