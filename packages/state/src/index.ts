export {
  activateTabInDockTree,
  applyDockTabDrop,
  createInitialDockTree,
  deriveDeterministicActiveTabId,
  ensureTabRegisteredInDockTree,
  moveTabWithinDockTree,
  readDockSplitRatio,
  removeTabFromDockTree,
  setDockSplitRatioById,
} from "./dock-tree.js";
export {
  focusActiveTabInDirection,
  focusAdjacentTabInActiveStack,
  moveActiveTabInDirection,
  moveActiveTabToDirectionalGroup,
  resizeNearestSplitInDirection,
  swapActiveTabInDirection,
} from "./dock-tree-operations.js";
export { setDockSplitRatio } from "./dock-tree-ratio.js";
export type {
  DockDirection,
  DockDropZone,
  DockNode,
  DockOrientation,
  DockSplitNode,
  DockStackNode,
  DockTabDropInput,
  DockTreeState,
} from "./dock-tree-types.js";
export type {
  IncomingTransferJournal,
  IncomingTransferTab,
  IncomingTransferTarget,
  IncomingTransferTransactionInput,
  IncomingTransferTransactionResult,
} from "./incoming-transfer-transaction.js";
export {
  applyIncomingTransferTransaction,
  createIncomingTransferJournal,
} from "./incoming-transfer-transaction.js";
export {
  readGlobalLane,
  readGroupLaneForTab,
  writeGlobalLane,
  writeGroupLaneByGroup,
  writeGroupLaneByTab,
  writeTabSubcontext,
} from "./lanes.js";
export type {
  EdgeSlotState,
  PaneResizeRequest,
  PartialLayoutState,
  ShellEdgeSlotsLayout,
  ShellLayoutState,
} from "./layout.js";
export {
  applyPaneResize,
  createDefaultEdgeSlotsLayout,
  createDefaultLayoutState,
  sanitizeLayoutState,
} from "./layout.js";
export {
  DEFAULT_PLACEMENT_CONFIG,
  DWINDLE_DIRECTION_CONFIG_KEY,
  PLACEMENT_STRATEGY_CONFIG_KEY,
} from "./placement-strategy/config.js";
export { createDwindlePlacementStrategy } from "./placement-strategy/dwindle.js";
export type { PlacementStrategyRegistry } from "./placement-strategy/registry.js";
export { createPlacementStrategyRegistry } from "./placement-strategy/registry.js";
export { initPlacementStrategy } from "./placement-strategy/setup.js";
export { createStackPlacementStrategy } from "./placement-strategy/stack.js";
export { createTabsPlacementStrategy } from "./placement-strategy/tabs.js";

export type {
  PlacementConfig,
  PlacementStrategyId,
  TabPlacementStrategy,
} from "./placement-strategy/types.js";
export {
  addEntityTypeSelectionId,
  moveEntityTypeSelectionId,
  readEntityTypeSelection,
  removeEntityTypeSelectionId,
  setEntityTypePriority,
  setEntityTypeSelection,
} from "./selection.js";
export { applySelectionUpdate } from "./selection-update.js";
export { createInitialShellContextState } from "./state.js";
export {
  canReopenClosedTab,
  closeTab,
  closeTabWithHistory,
  moveTabBeforeTab,
  moveTabInDockTree,
  moveTabToGroup,
  openPartInstance,
  registerTab,
  reopenMostRecentlyClosedTab,
  setActiveTab,
} from "./tabs-groups.js";
export {
  closeTabIfAllowed,
  closeTabIfAllowedWithHistory,
  getTabCloseability,
  getTabGroupId,
} from "./tabs-groups-closeability.js";
export type {
  ClosedTabHistoryEntry,
  ContextGroup,
  ContextLaneValue,
  ContextTab,
  ContextTabCloseActionAvailability,
  ContextTabCloseability,
  ContextTabClosePolicy,
  ContextTabSlot,
  DerivedLaneDefinition,
  EntityTypeSelection,
  PanelId,
  RevisionMeta,
  SelectionPropagationRule,
  SelectionUpdateOptions,
  SelectionUpdateResult,
  SelectionWriteInput,
  ShellContextState,
  TabInstanceId,
} from "./types.js";
export {
  absorbStackInDirection,
  cycleTabGroup,
  cycleTabInActiveStack,
  detachTabInDirection,
  equalizeSplits,
  explodeActiveStack,
  focusTabInDirection,
  gotoTabByIndex,
  moveTabInDirection,
  navigateBackInActiveStack,
  navigateForwardInActiveStack,
  reorderActiveTabInStack,
  resizeInDirection,
  swapTabInDirection,
} from "./window-management.js";
export {
  createInitialWorkspaceManagerState,
  createWorkspace,
  deleteWorkspace,
  moveTabToWorkspace,
  renameWorkspace,
  reorderWorkspace,
  switchWorkspace,
} from "./workspace.js";
export type {
  Workspace,
  WorkspaceManagerState,
  WorkspaceOperationResult,
  WorkspaceSwitchResult,
} from "./workspace-types.js";
