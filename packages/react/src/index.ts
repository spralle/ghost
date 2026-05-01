export type { ReactPartsModule } from "@ghost-shell/contracts/parts";
// Re-export React parts detection — canonical import path for React module detection
export {
  containsReactParts,
  findReactPartsModule,
  isReactPartsModule,
  REACT_PARTS_SYMBOL,
} from "@ghost-shell/contracts/parts";
export { defineReactParts } from "./define-react-parts.js";
export type { GhostContextValue } from "./ghost-context.js";
export { GhostContext, GhostProvider } from "./ghost-context.js";
export {
  createContextHook,
  createServiceHook,
  useContextValue,
  useGhostApi,
  usePluginContext,
  useService,
} from "./hooks.js";
export { PluginErrorBoundary } from "./PluginErrorBoundary.js";
export { createReactPartRenderer } from "./react-part-renderer.js";
export { GhostLink, type GhostLinkProps } from "./GhostLink.js";
export { IntentLink, type IntentLinkProps } from "./IntentLink.js";
export { ViewLink, type ViewLinkProps } from "./ViewLink.js";
export { ActionLink, type ActionLinkProps } from "./ActionLink.js";
