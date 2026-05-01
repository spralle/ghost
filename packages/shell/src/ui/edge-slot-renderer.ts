import type { ShellEdgeSlot, ShellEdgeSlotPosition } from "@ghost-shell/contracts";
import { type ComposedPluginSlotContribution, composeEnabledPluginContributions, evaluateContributionPredicate } from "@ghost-shell/plugin-system";
import type { ShellRuntime } from "../app/types.js";
import {
  ensureRemoteRegistered,
  type MountCleanup,
  normalizeCleanup,
  safeUnmount,
  toRecord,
} from "../federation-mount-utils.js";
import type { ShellFederationRuntime } from "../federation-runtime.js";
import { getLayoutModeService } from "../services/layout-mode-service-registration.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuiltInSlotMountFn = (
  target: HTMLElement,
  context: {
    contribution: ComposedPluginSlotContribution;
    runtime: ShellRuntime;
  },
) => MountCleanup | Promise<MountCleanup>;

interface SlotMountEntry {
  target: HTMLElement;
  cleanup: (() => void) | null;
  mountKey: string;
}

const EDGE_SLOTS: ShellEdgeSlot[] = ["top", "bottom", "left", "right"];
const POSITIONS: ShellEdgeSlotPosition[] = ["start", "center", "end"];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface EdgeSlotRendererOptions {
  federationRuntime: ShellFederationRuntime;
}

export interface EdgeSlotRenderer {
  renderEdgeSlots(root: HTMLElement, runtime: ShellRuntime): void;
  unmountAll(): void;
  registerBuiltInSlotMount(componentId: string, mountFn: BuiltInSlotMountFn): void;
}

export function createEdgeSlotRenderer(options: EdgeSlotRendererOptions): EdgeSlotRenderer {
  const { federationRuntime } = options;
  const mounted = new Map<string, SlotMountEntry>();
  const registeredRemoteIds = new Set<string>();
  const builtInSlotMounts = new Map<string, BuiltInSlotMountFn>();
  let generation = 0;

  function registerBuiltInSlotMount(component: string, mount: BuiltInSlotMountFn): void {
    builtInSlotMounts.set(component, mount);
  }

  function renderEdgeSlots(root: HTMLElement, runtime: ShellRuntime): void {
    generation += 1;
    const currentGeneration = generation;

    const allContributions = gatherSlotContributions(runtime);

    // Evaluate when-predicates against current layout facts
    const layoutFacts = getLayoutModeService()?.getContextFacts() ?? {};
    const visibleIds = new Set<string>();
    const contributions: ComposedPluginSlotContribution[] = [];
    for (const c of allContributions) {
      if (evaluateContributionPredicate(c.when, layoutFacts)) {
        visibleIds.add(c.id);
        contributions.push(c);
      }
    }

    const edgeSlotsLayout = runtime.layout.edgeSlots;

    // Hide (not destroy) mount targets for contributions whose when-predicate is false
    hideFilteredContributions(allContributions, visibleIds);

    pruneRemovedContributions(contributions);

    for (const slotName of EDGE_SLOTS) {
      renderSingleEdgeSlot(root, slotName, contributions, edgeSlotsLayout, runtime, currentGeneration);
    }
  }

  /** Set display:none on mount targets for contributions hidden by when-predicate. */
  function hideFilteredContributions(
    allContributions: ComposedPluginSlotContribution[],
    visibleIds: Set<string>,
  ): void {
    for (const c of allContributions) {
      const entry = mounted.get(c.id);
      if (!entry) continue;
      if (visibleIds.has(c.id)) {
        entry.target.style.display = "";
      } else {
        entry.target.style.display = "none";
      }
    }
  }

  function pruneRemovedContributions(contributions: ComposedPluginSlotContribution[]): void {
    const desiredIds = new Set(contributions.map((c) => c.id));
    for (const [id, entry] of mounted.entries()) {
      if (!desiredIds.has(id)) {
        safeUnmount(entry.cleanup);
        entry.target.remove();
        mounted.delete(id);
      }
    }
  }

  function renderSingleEdgeSlot(
    root: HTMLElement,
    slotName: ShellEdgeSlot,
    contributions: ComposedPluginSlotContribution[],
    edgeSlotsLayout: ShellRuntime["layout"]["edgeSlots"],
    runtime: ShellRuntime,
    currentGeneration: number,
  ): void {
    const section = root.querySelector<HTMLElement>(`.edge-slot-${slotName}`);
    if (!section) {
      return;
    }

    const slotContributions = contributions.filter((c) => c.slot === slotName);
    const slotState = edgeSlotsLayout?.[slotName];
    const isVisible = slotState ? slotState.visible : slotContributions.length > 0;

    if (!isVisible || slotContributions.length === 0) {
      section.style.display = "none";
      section.innerHTML = "";
      for (const c of slotContributions) {
        const entry = mounted.get(c.id);
        if (entry) {
          safeUnmount(entry.cleanup);
          mounted.delete(c.id);
        }
      }
      return;
    }

    section.style.display = "";
    ensurePositionContainers(section, slotName);

    for (const position of POSITIONS) {
      const container = section.querySelector<HTMLElement>(`.edge-slot-${position}`);
      if (!container) {
        continue;
      }
      const positionContributions = slotContributions
        .filter((c) => c.position === position)
        .sort((a, b) => a.order - b.order);
      reconcilePositionContainer(container, positionContributions, runtime, currentGeneration);
    }
  }

  function unmountAll(): void {
    for (const [id, entry] of mounted.entries()) {
      safeUnmount(entry.cleanup);
      mounted.delete(id);
    }
    generation += 1;
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  function ensurePositionContainers(section: HTMLElement, _slotName: ShellEdgeSlot): void {
    for (const position of POSITIONS) {
      const className = `edge-slot-${position}`;
      if (!section.querySelector(`.${className}`)) {
        const div = document.createElement("div");
        div.className = className;
        section.appendChild(div);
      }
    }
  }

  function reconcilePositionContainer(
    container: HTMLElement,
    contributions: ComposedPluginSlotContribution[],
    runtime: ShellRuntime,
    currentGeneration: number,
  ): void {
    pruneStaleChildren(container, contributions);

    let previousElement: Element | null = null;
    for (const contribution of contributions) {
      const target = ensureMountTarget(container, contribution, previousElement);
      previousElement = target;
      reconcileSingleMount(target, contribution, runtime, currentGeneration);
    }
  }

  function pruneStaleChildren(container: HTMLElement, contributions: ComposedPluginSlotContribution[]): void {
    const desiredIds = new Set(contributions.map((c) => c.id));
    for (const child of Array.from(container.children) as HTMLElement[]) {
      const contentId = child.dataset.slotContentFor;
      if (contentId && !desiredIds.has(contentId)) {
        const entry = mounted.get(contentId);
        if (entry) {
          safeUnmount(entry.cleanup);
          mounted.delete(contentId);
        }
        child.remove();
      }
    }
  }

  function ensureMountTarget(
    container: HTMLElement,
    contribution: ComposedPluginSlotContribution,
    previousElement: Element | null,
  ): HTMLElement {
    let target = container.querySelector<HTMLElement>(`[data-slot-content-for="${contribution.id}"]`);
    if (!target) {
      target = document.createElement("div");
      target.dataset.slotContentFor = contribution.id;
      if (previousElement?.nextSibling) {
        container.insertBefore(target, previousElement.nextSibling);
      } else if (!previousElement && container.firstChild) {
        container.insertBefore(target, container.firstChild);
      } else {
        container.appendChild(target);
      }
    }
    return target;
  }

  function reconcileSingleMount(
    target: HTMLElement,
    contribution: ComposedPluginSlotContribution,
    runtime: ShellRuntime,
    currentGeneration: number,
  ): void {
    const existing = mounted.get(contribution.id);
    const mountKey = createSlotMountKey(contribution, runtime);
    if (existing && existing.target === target && existing.mountKey === mountKey) {
      return;
    }
    if (existing) {
      safeUnmount(existing.cleanup);
      mounted.delete(contribution.id);
    }
    void mountSlotComponent(target, contribution, runtime, mountKey, currentGeneration);
  }

  // ---------------------------------------------------------------------------
  // Mount logic
  // ---------------------------------------------------------------------------

  async function mountSlotComponent(
    target: HTMLElement,
    contribution: ComposedPluginSlotContribution,
    runtime: ShellRuntime,
    mountKey: string,
    expectedGeneration: number,
  ): Promise<void> {
    const builtInMount = builtInSlotMounts.get(contribution.component);
    if (builtInMount) {
      await mountBuiltInSlot(target, contribution, runtime, mountKey, expectedGeneration, builtInMount);
      return;
    }
    await mountFederatedSlot(target, contribution, runtime, mountKey, expectedGeneration);
  }

  async function mountBuiltInSlot(
    target: HTMLElement,
    contribution: ComposedPluginSlotContribution,
    runtime: ShellRuntime,
    mountKey: string,
    expectedGeneration: number,
    builtInMount: BuiltInSlotMountFn,
  ): Promise<void> {
    try {
      const cleanupResult = await builtInMount(target, { contribution, runtime });
      const cleanup = normalizeCleanup(cleanupResult);
      if (generation !== expectedGeneration) {
        safeUnmount(cleanup);
        return;
      }
      mounted.set(contribution.id, { target, cleanup, mountKey });
    } catch {
      // Built-in mount failed — slot stays empty, no crash.
    }
  }

  async function mountFederatedSlot(
    target: HTMLElement,
    contribution: ComposedPluginSlotContribution,
    runtime: ShellRuntime,
    mountKey: string,
    expectedGeneration: number,
  ): Promise<void> {
    const snapshot = runtime.registry.getSnapshot();
    const pluginSnapshot = snapshot.plugins.find((p) => p.id === contribution.pluginId);

    ensureRemoteRegistered(
      contribution.pluginId,
      registeredRemoteIds,
      () => pluginSnapshot?.descriptor,
      (desc) => federationRuntime.registerRemote(desc),
    );

    try {
      const remoteModule = await federationRuntime.loadRemoteModule(contribution.pluginId, "./pluginSlots");
      if (generation !== expectedGeneration) {
        return;
      }
      const mountFn = resolveSlotMount(remoteModule, contribution);
      if (!mountFn) {
        return;
      }
      const cleanupResult = await mountFn(target, { contribution, runtime });
      const cleanup = normalizeCleanup(cleanupResult);
      if (generation !== expectedGeneration) {
        safeUnmount(cleanup);
        return;
      }
      mounted.set(contribution.id, { target, cleanup, mountKey });
    } catch {
      // Mount failed — slot stays empty, no crash.
    }
  }

  return { renderEdgeSlots, unmountAll, registerBuiltInSlotMount };
}

// ---------------------------------------------------------------------------
// Contribution gathering
// ---------------------------------------------------------------------------

function gatherSlotContributions(runtime: ShellRuntime): ComposedPluginSlotContribution[] {
  const snapshot = runtime.registry.getSnapshot();
  const composed = composeEnabledPluginContributions(
    snapshot.plugins.map((plugin) => ({
      id: plugin.id,
      enabled: plugin.enabled,
      contract: plugin.contract,
    })),
  );
  return composed.slots;
}

// ---------------------------------------------------------------------------
// Slot mount resolution
// ---------------------------------------------------------------------------

type MountSlotComponentFn = (
  target: HTMLElement,
  context: {
    contribution: ComposedPluginSlotContribution;
    runtime: ShellRuntime;
  },
) => MountCleanup | Promise<MountCleanup>;

function resolveSlotMount(
  moduleValue: unknown,
  contribution: ComposedPluginSlotContribution,
): MountSlotComponentFn | null {
  const moduleRecord = toRecord(moduleValue);
  if (!moduleRecord) {
    return null;
  }

  // Try: module.mountSlot (generic mount function)
  if (typeof moduleRecord.mountSlot === "function") {
    return moduleRecord.mountSlot as MountSlotComponentFn;
  }

  // Try: module.slots[component].mount or module.slots[component] (function)
  const slots = toRecord(moduleRecord.slots);
  if (slots) {
    const candidate = slots[contribution.component] ?? slots[contribution.id];
    if (typeof candidate === "function") {
      return candidate as MountSlotComponentFn;
    }
    const candidateRecord = toRecord(candidate);
    if (candidateRecord && typeof candidateRecord.mount === "function") {
      return candidateRecord.mount as MountSlotComponentFn;
    }
  }

  // Try: module.default
  if (typeof moduleRecord.default === "function") {
    return moduleRecord.default as MountSlotComponentFn;
  }
  const defaultRecord = toRecord(moduleRecord.default);
  if (defaultRecord && typeof defaultRecord.mount === "function") {
    return defaultRecord.mount as MountSlotComponentFn;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function createSlotMountKey(contribution: ComposedPluginSlotContribution, runtime: ShellRuntime): string {
  const snapshot = runtime.registry.getSnapshot();
  const pluginSnapshot = snapshot.plugins.find((p) => p.id === contribution.pluginId);
  if (!pluginSnapshot) {
    return `${contribution.pluginId}|${contribution.id}|missing`;
  }
  const enabledState = pluginSnapshot.enabled ? "enabled" : "disabled";
  const lifecycleState = pluginSnapshot.lifecycle?.state ?? "lifecycle:unknown";
  return [contribution.pluginId, contribution.id, enabledState, lifecycleState].join("|");
}
