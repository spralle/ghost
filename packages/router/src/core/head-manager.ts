import type { HeadConfig, HeadManagerOptions, LinkTag, MetaTag } from "./head-types.js";

/** Merge multiple HeadConfigs (parent → child). Title: last wins. Meta: merge by key. Link: merge by rel. */
export function mergeHeadConfigs(configs: readonly HeadConfig[]): HeadConfig {
  let title: string | undefined;
  const metaMap = new Map<string, MetaTag>();
  const linkMap = new Map<string, LinkTag>();

  for (const config of configs) {
    if (config.title !== undefined) title = config.title;
    for (const meta of config.meta ?? []) {
      const key = meta.property ?? meta.name ?? "";
      if (key) metaMap.set(key, meta);
    }
    for (const link of config.link ?? []) {
      const key = `${link.rel}:${link.type ?? ""}`;
      linkMap.set(key, link);
    }
  }

  return {
    title,
    meta: metaMap.size > 0 ? [...metaMap.values()] : undefined,
    link: linkMap.size > 0 ? [...linkMap.values()] : undefined,
  };
}

/** Apply title template: "{title} | My Workspace" → "Vessel Detail | My Workspace". */
export function applyTitleTemplate(template: string, title: string): string {
  return template.replace("{title}", title);
}

/** Managed head tags tracked for cleanup. */
interface ManagedHeadState {
  readonly managedMetaTags: HTMLMetaElement[];
  readonly managedLinkTags: HTMLLinkElement[];
  readonly previousTitle: string;
}

/** Create a HeadManager that applies HeadConfig to the document. */
export function createHeadManager(options: HeadManagerOptions = {}) {
  let state: ManagedHeadState | null = null;

  /** Remove all managed tags. */
  function cleanup(): void {
    if (!state) return;
    for (const el of state.managedMetaTags) el.remove();
    for (const el of state.managedLinkTags) el.remove();
    state = null;
  }

  /** Apply a merged HeadConfig to the document. */
  function apply(config: HeadConfig): void {
    cleanup();

    const managedMetaTags: HTMLMetaElement[] = [];
    const managedLinkTags: HTMLLinkElement[] = [];
    const previousTitle = document.title;

    // Apply title
    if (config.title !== undefined) {
      document.title = options.titleTemplate
        ? applyTitleTemplate(options.titleTemplate, config.title)
        : config.title;
    }

    // Apply meta tags
    for (const meta of config.meta ?? []) {
      const el = document.createElement("meta");
      if (meta.name) el.setAttribute("name", meta.name);
      if (meta.property) el.setAttribute("property", meta.property);
      el.setAttribute("content", meta.content);
      el.setAttribute("data-ghost-managed", "true");
      document.head.appendChild(el);
      managedMetaTags.push(el);
    }

    // Apply link tags
    for (const link of config.link ?? []) {
      const el = document.createElement("link");
      el.setAttribute("rel", link.rel);
      el.setAttribute("href", link.href);
      if (link.type) el.setAttribute("type", link.type);
      el.setAttribute("data-ghost-managed", "true");
      document.head.appendChild(el);
      managedLinkTags.push(el);
    }

    state = { managedMetaTags, managedLinkTags, previousTitle };
  }

  /** Merge configs then apply. */
  function mergeAndApply(configs: readonly HeadConfig[]): void {
    apply(mergeHeadConfigs(configs));
  }

  return { apply, cleanup, mergeAndApply };
}
