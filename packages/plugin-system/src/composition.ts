import type { PluginLayerSurfaceContribution } from "@ghost-shell/contracts/layer";
import type {
  PluginContributionPredicate,
  PluginContract,
  PluginDockableTabMetadata,
  PluginPartContribution,
  PluginSectionContribution,
  PluginSlotContribution,
  PluginViewContribution,
  ShellEdgeSlot,
  ShellEdgeSlotPosition,
  ThemeContribution,
} from "@ghost-shell/contracts/plugin";

export interface ComposedPluginViewContribution {
  pluginId: string;
  id: string;
  title: string;
  component: string;
}

export interface ComposedPluginPartContribution {
  pluginId: string;
  id: string;
  title: string;
  component?: string | undefined;
  dock?: PluginDockableTabMetadata | undefined;
}

export interface ComposedPluginSlotContribution {
  pluginId: string;
  id: string;
  slot: ShellEdgeSlot;
  position: ShellEdgeSlotPosition;
  order: number;
  component: string;
  when?: PluginContributionPredicate | undefined;
}

/** Composed section contribution with source plugin identity. */
export interface ComposedPluginSectionContribution {
  /** ID of the plugin contributing this section. */
  pluginId: string;
  /** Unique identifier for this section contribution. */
  id: string;
  /** Display title rendered as the section heading. */
  title: string;
  /** Target container identifier (e.g. "config.appearance"). */
  target: string;
  /** Sort order within the target — lower values render first. */
  order: number;
  /** Key used to resolve the mount function from the contributing plugin's components. */
  component: string;
}

export interface ComposedPluginLayerSurfaceContribution {
  pluginId: string;
  surface: PluginLayerSurfaceContribution;
}

export interface ComposedPluginContributions {
  views: ComposedPluginViewContribution[];
  parts: ComposedPluginPartContribution[];
  slots: ComposedPluginSlotContribution[];
  sections: ComposedPluginSectionContribution[];
  layerSurfaces: ComposedPluginLayerSurfaceContribution[];
}

export interface PluginContributionSource {
  id: string;
  enabled: boolean;
  contract: PluginContract | null;
}

/**
 * Composes contributions from all enabled plugins.
 *
 * NOTE: Adding a new contribution type requires modifying this function.
 * Consider extracting a ContributionStrategy<T> pattern if contribution
 * types grow beyond the current set. See armada-7fks.
 */
export function composeEnabledPluginContributions(plugins: PluginContributionSource[]): ComposedPluginContributions {
  const views: ComposedPluginViewContribution[] = [];
  const parts: ComposedPluginPartContribution[] = [];
  const slots: ComposedPluginSlotContribution[] = [];
  const sections: ComposedPluginSectionContribution[] = [];
  const layerSurfaces: ComposedPluginLayerSurfaceContribution[] = [];

  for (const plugin of plugins) {
    if (!plugin.enabled || !plugin.contract) {
      continue;
    }

    const contributes = plugin.contract.contributes;
    const pluginViews = contributes?.views ?? [];
    const pluginParts = contributes?.parts ?? [];
    const pluginSlots = contributes?.slots ?? [];
    const pluginSections = contributes?.sections ?? [];
    const pluginLayerSurfaces = contributes?.layerSurfaces ?? [];

    for (const view of pluginViews) {
      views.push(toComposedView(plugin.id, view));
    }

    for (const part of pluginParts) {
      parts.push(toComposedPart(plugin.id, part));
    }

    for (const slot of pluginSlots) {
      slots.push(toComposedSlot(plugin.id, slot));
    }

    for (const section of pluginSections) {
      sections.push(toComposedSection(plugin.id, section));
    }

    for (const surface of pluginLayerSurfaces) {
      layerSurfaces.push({ pluginId: plugin.id, surface });
    }
  }

  return {
    views,
    parts,
    slots,
    sections,
    layerSurfaces,
  };
}

function toComposedView(pluginId: string, view: PluginViewContribution): ComposedPluginViewContribution {
  return {
    pluginId,
    id: view.id,
    title: view.title,
    component: view.component,
  };
}

function toComposedPart(pluginId: string, part: PluginPartContribution): ComposedPluginPartContribution {
  return {
    pluginId,
    id: part.id,
    title: part.title,
    component: part.component,
    dock: part.dock,
  };
}

function toComposedSlot(pluginId: string, slot: PluginSlotContribution): ComposedPluginSlotContribution {
  return {
    pluginId,
    id: slot.id,
    slot: slot.slot,
    position: slot.position,
    order: slot.order,
    component: slot.component,
    when: slot.when,
  };
}

function toComposedSection(pluginId: string, section: PluginSectionContribution): ComposedPluginSectionContribution {
  return {
    pluginId,
    id: section.id,
    title: section.title,
    target: section.target,
    order: section.order,
    component: section.component,
  };
}

// ---------------------------------------------------------------------------
// Theme composition
// ---------------------------------------------------------------------------

export interface ComposedThemeContribution extends ThemeContribution {
  pluginId: string;
}

/**
 * Collect all theme contributions from the given plugins, tagging each with
 * its originating pluginId.
 */
export function composeThemeContributions(
  plugins: Array<{ pluginId: string; contract: PluginContract }>,
): ComposedThemeContribution[] {
  const result: ComposedThemeContribution[] = [];

  for (const plugin of plugins) {
    const themes = plugin.contract.contributes?.themes ?? [];
    for (const theme of themes) {
      result.push({ ...theme, pluginId: plugin.pluginId });
    }
  }

  return result;
}
