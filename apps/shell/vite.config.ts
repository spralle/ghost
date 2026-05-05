import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SHELL_DEV_PORT = 5173;
const BACKEND_DEV_PORT = 8787;

// Resolve helper: returns the absolute path to a package's src directory
const pkgSrc = (name: string) => fileURLToPath(new URL(`../../packages/${name}/src`, import.meta.url));

// Resolve helper for linked @weaver/* packages — resolves through node_modules symlinks to source
const weaverSrc = (name: string) => fileURLToPath(new URL(`../../node_modules/@weaver/${name}/src`, import.meta.url));

const PLUGIN_CONTRACTS_SRC = pkgSrc("plugin-contracts");
const PREDICATE_SRC_ROOT = pkgSrc("predicate");
const UI_SRC_ROOT = pkgSrc("ui");
const SHELL_SRC_ROOT = pkgSrc("shell");
const LAYER_SRC_ROOT = pkgSrc("layer");
const THEME_SRC_ROOT = pkgSrc("theme");
const PLUGIN_SYSTEM_SRC_ROOT = pkgSrc("plugin-system");
const FEDERATION_SRC_ROOT = pkgSrc("federation");
const STATE_SRC_ROOT = pkgSrc("state");
const PERSISTENCE_SRC_ROOT = pkgSrc("persistence");
const ROUTER_SRC_ROOT = pkgSrc("router");
const INTENTS_SRC_ROOT = pkgSrc("intents");
const ARBITER_SRC_ROOT = pkgSrc("arbiter");
const BRIDGE_SRC_ROOT = pkgSrc("bridge");
const COMMANDS_SRC_ROOT = pkgSrc("commands");
const CONFIG_PLUGIN_RUNTIME_SRC_ROOT = pkgSrc("config-plugin-runtime");
const DATA_TABLE_SRC_ROOT = pkgSrc("data-table");
const ENTITY_TABLE_SRC_ROOT = pkgSrc("entity-table");
const FORMR_CORE_SRC_ROOT = pkgSrc("formr-core");
const FORMR_FROM_SCHEMA_SRC_ROOT = pkgSrc("formr-from-schema");
const FORMR_REACT_SRC_ROOT = pkgSrc("formr-react");
const REACT_SRC_ROOT = pkgSrc("react");
const SCHEMA_CORE_SRC_ROOT = pkgSrc("scheman-core");
const TABLE_FROM_SCHEMA_SRC_ROOT = pkgSrc("table-from-schema");
const WEAVER_FORMR_BRIDGE_SRC_ROOT = pkgSrc("weaver-formr-bridge");

const WEAVER_CONFIG_ENGINE_SRC = weaverSrc("config-engine");
const WEAVER_CONFIG_TYPES_SRC = weaverSrc("config-types");
const WEAVER_CONFIG_PROVIDERS_SRC = weaverSrc("config-providers");
const WEAVER_CONFIG_SESSIONS_SRC = weaverSrc("config-sessions");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Subpath aliases must come before root aliases for correct matching order
      "@ghost-shell/contracts/": `${PLUGIN_CONTRACTS_SRC}/`,
      "@ghost-shell/contracts": `${PLUGIN_CONTRACTS_SRC}/index.ts`,
      "@ghost-shell/predicate/": `${PREDICATE_SRC_ROOT}/`,
      "@ghost-shell/predicate": `${PREDICATE_SRC_ROOT}/index.ts`,
      "@ghost-shell/ui/": `${UI_SRC_ROOT}/`,
      "@ghost-shell/ui": `${UI_SRC_ROOT}/index.ts`,
      "@ghost-shell/shell/": `${SHELL_SRC_ROOT}/`,
      "@ghost-shell/shell": `${SHELL_SRC_ROOT}/index.ts`,
      "@ghost-shell/layer/": `${LAYER_SRC_ROOT}/`,
      "@ghost-shell/layer": `${LAYER_SRC_ROOT}/index.ts`,
      "@ghost-shell/theme/": `${THEME_SRC_ROOT}/`,
      "@ghost-shell/theme": `${THEME_SRC_ROOT}/index.ts`,
      "@ghost-shell/plugin-system/": `${PLUGIN_SYSTEM_SRC_ROOT}/`,
      "@ghost-shell/plugin-system": `${PLUGIN_SYSTEM_SRC_ROOT}/index.ts`,
      "@ghost-shell/federation/": `${FEDERATION_SRC_ROOT}/`,
      "@ghost-shell/federation": `${FEDERATION_SRC_ROOT}/index.ts`,
      "@ghost-shell/state/": `${STATE_SRC_ROOT}/`,
      "@ghost-shell/state": `${STATE_SRC_ROOT}/index.ts`,
      "@ghost-shell/persistence/": `${PERSISTENCE_SRC_ROOT}/`,
      "@ghost-shell/persistence": `${PERSISTENCE_SRC_ROOT}/index.ts`,
      "@ghost-shell/router/": `${ROUTER_SRC_ROOT}/`,
      "@ghost-shell/router": `${ROUTER_SRC_ROOT}/index.ts`,
      "@ghost-shell/intents/": `${INTENTS_SRC_ROOT}/`,
      "@ghost-shell/intents": `${INTENTS_SRC_ROOT}/index.ts`,
      "@ghost-shell/arbiter/": `${ARBITER_SRC_ROOT}/`,
      "@ghost-shell/arbiter": `${ARBITER_SRC_ROOT}/index.ts`,
      "@ghost-shell/bridge/": `${BRIDGE_SRC_ROOT}/`,
      "@ghost-shell/bridge": `${BRIDGE_SRC_ROOT}/index.ts`,
      "@ghost-shell/commands/": `${COMMANDS_SRC_ROOT}/`,
      "@ghost-shell/commands": `${COMMANDS_SRC_ROOT}/index.ts`,
      "@ghost-shell/config-plugin-runtime/": `${CONFIG_PLUGIN_RUNTIME_SRC_ROOT}/`,
      "@ghost-shell/config-plugin-runtime": `${CONFIG_PLUGIN_RUNTIME_SRC_ROOT}/index.ts`,
      "@ghost-shell/data-table/": `${DATA_TABLE_SRC_ROOT}/`,
      "@ghost-shell/data-table": `${DATA_TABLE_SRC_ROOT}/index.ts`,
      "@ghost-shell/entity-table/": `${ENTITY_TABLE_SRC_ROOT}/`,
      "@ghost-shell/entity-table": `${ENTITY_TABLE_SRC_ROOT}/index.ts`,
      "@ghost-shell/formr-core/": `${FORMR_CORE_SRC_ROOT}/`,
      "@ghost-shell/formr-core": `${FORMR_CORE_SRC_ROOT}/index.ts`,
      "@ghost-shell/formr-from-schema/": `${FORMR_FROM_SCHEMA_SRC_ROOT}/`,
      "@ghost-shell/formr-from-schema": `${FORMR_FROM_SCHEMA_SRC_ROOT}/index.ts`,
      "@ghost-shell/formr-react/": `${FORMR_REACT_SRC_ROOT}/`,
      "@ghost-shell/formr-react": `${FORMR_REACT_SRC_ROOT}/index.ts`,
      "@ghost-shell/react/": `${REACT_SRC_ROOT}/`,
      "@ghost-shell/react": `${REACT_SRC_ROOT}/index.ts`,
      "@scheman/core/": `${SCHEMA_CORE_SRC_ROOT}/`,
      "@scheman/core": `${SCHEMA_CORE_SRC_ROOT}/index.ts`,
      "@ghost-shell/table-from-schema/": `${TABLE_FROM_SCHEMA_SRC_ROOT}/`,
      "@ghost-shell/table-from-schema": `${TABLE_FROM_SCHEMA_SRC_ROOT}/index.ts`,
      "@ghost-shell/weaver-formr-bridge/": `${WEAVER_FORMR_BRIDGE_SRC_ROOT}/`,
      "@ghost-shell/weaver-formr-bridge": `${WEAVER_FORMR_BRIDGE_SRC_ROOT}/index.ts`,
      // @weaver/* packages — linked from external weaver project
      "@weaver/config-engine": `${WEAVER_CONFIG_ENGINE_SRC}/index.ts`,
      "@weaver/config-types": `${WEAVER_CONFIG_TYPES_SRC}/index.ts`,
      "@weaver/config-providers": `${WEAVER_CONFIG_PROVIDERS_SRC}/index.ts`,
      "@weaver/config-sessions": `${WEAVER_CONFIG_SESSIONS_SRC}/index.ts`,
      // Mirror the UI package's tsconfig path mapping so that its internal
      // `@/lib/utils` imports resolve when the shell consumes raw source.
      "@/": `${UI_SRC_ROOT}/`,
    },
  },
  server: {
    host: "127.0.0.1",
    port: SHELL_DEV_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${BACKEND_DEV_PORT}`,
        changeOrigin: true,
      },
    },
  },
});