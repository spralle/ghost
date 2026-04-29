/**
 * DOM style synchronization — observes style mutations on the host and
 * replays them on popout windows for consistent theming.
 */

// ---------------------------------------------------------------------------
// Wire types — serializable mutation descriptors
// ---------------------------------------------------------------------------

/** Serialized style element added/updated in document.head. */
export interface StyleElementMutation {
  readonly type: "style-element";
  readonly action: "add" | "update" | "remove";
  readonly id: string;
  readonly tagName: "style" | "link";
  readonly content?: string;
  readonly href?: string;
  readonly rel?: string;
  readonly attributes?: Record<string, string>;
}

/** Serialized attribute change on document.documentElement. */
export interface RootAttributeMutation {
  readonly type: "root-attribute";
  readonly action: "set" | "remove";
  readonly name: string;
  readonly value?: string;
}

/** Union of all DOM sync mutations. */
export type DomSyncMutation = StyleElementMutation | RootAttributeMutation;

/** Full snapshot of current styles for initial sync. */
export interface DomStyleSnapshot {
  readonly styleElements: StyleElementMutation[];
  readonly rootAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Observer — watches host document for style changes
// ---------------------------------------------------------------------------

export interface DomStyleObserver {
  getSnapshot(): DomStyleSnapshot;
  subscribe(callback: (mutations: DomSyncMutation[]) => void): () => void;
  dispose(): void;
}

/**
 * Creates an observer that watches document.head and documentElement for
 * style-related changes and emits serialized mutations.
 */
export function createDomStyleObserver(doc: Document = document): DomStyleObserver {
  const subscribers = new Set<(mutations: DomSyncMutation[]) => void>();
  let disposed = false;

  function emit(mutations: DomSyncMutation[]): void {
    if (mutations.length === 0 || disposed) return;
    for (const sub of subscribers) {
      sub(mutations);
    }
  }

  const headObserver = new MutationObserver((records) => {
    const muts: DomSyncMutation[] = [];
    for (const record of records) {
      if (record.type === "childList") {
        for (const node of record.addedNodes) {
          const mut = serializeStyleNode(node, "add");
          if (mut) muts.push(mut);
        }
        for (const node of record.removedNodes) {
          const mut = serializeStyleNode(node, "remove");
          if (mut) muts.push(mut);
        }
      } else if (record.type === "characterData") {
        const parent = record.target.parentElement;
        if (parent && parent.tagName === "STYLE") {
          const mut = serializeStyleNode(parent, "update");
          if (mut) muts.push(mut);
        }
      } else if (record.type === "attributes" && record.target instanceof Element) {
        const el = record.target;
        if (el.tagName === "STYLE" || el.tagName === "LINK") {
          const mut = serializeStyleNode(el, "update");
          if (mut) muts.push(mut);
        }
      }
    }
    emit(muts);
  });

  const rootObserver = new MutationObserver((records) => {
    const muts: DomSyncMutation[] = [];
    for (const record of records) {
      if (record.type === "attributes" && record.attributeName) {
        const value = doc.documentElement.getAttribute(record.attributeName);
        muts.push({
          type: "root-attribute",
          action: value !== null ? "set" : "remove",
          name: record.attributeName,
          value: value ?? undefined,
        });
      }
    }
    emit(muts);
  });

  headObserver.observe(doc.head, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href", "rel", "media", "data-theme-id", "id"],
  });

  rootObserver.observe(doc.documentElement, {
    attributes: true,
  });

  function getSnapshot(): DomStyleSnapshot {
    const styleElements: StyleElementMutation[] = [];
    for (const el of doc.head.querySelectorAll("style, link[rel='stylesheet']")) {
      const mut = serializeStyleNode(el, "add");
      if (mut) styleElements.push(mut);
    }

    const rootAttributes: Record<string, string> = {};
    for (const attr of doc.documentElement.attributes) {
      rootAttributes[attr.name] = attr.value;
    }

    return { styleElements, rootAttributes };
  }

  return {
    getSnapshot,
    subscribe(callback) {
      subscribers.add(callback);
      return () => { subscribers.delete(callback); };
    },
    dispose() {
      disposed = true;
      headObserver.disconnect();
      rootObserver.disconnect();
      subscribers.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Replayer — applies serialized mutations to a target document
// ---------------------------------------------------------------------------

/** Apply a full style snapshot to a target document (initial sync). */
export function applyDomStyleSnapshot(snapshot: DomStyleSnapshot, targetDoc: Document): void {
  for (const [name, value] of Object.entries(snapshot.rootAttributes)) {
    targetDoc.documentElement.setAttribute(name, value);
  }
  for (const mut of snapshot.styleElements) {
    applyStyleElementMutation(mut, targetDoc);
  }
}

/** Apply a batch of DOM sync mutations to a target document. */
export function applyDomSyncMutations(mutations: DomSyncMutation[], targetDoc: Document): void {
  for (const mut of mutations) {
    if (mut.type === "style-element") {
      applyStyleElementMutation(mut, targetDoc);
    } else if (mut.type === "root-attribute") {
      if (mut.action === "set" && mut.value !== undefined) {
        targetDoc.documentElement.setAttribute(mut.name, mut.value);
      } else {
        targetDoc.documentElement.removeAttribute(mut.name);
      }
    }
  }
}

function applyStyleElementMutation(mut: StyleElementMutation, targetDoc: Document): void {
  if (mut.action === "remove") {
    const existing = targetDoc.getElementById(mut.id)
      ?? targetDoc.head.querySelector(`[data-sync-id="${mut.id}"]`);
    if (existing) existing.remove();
    return;
  }

  let el = targetDoc.getElementById(mut.id)
    ?? targetDoc.head.querySelector(`[data-sync-id="${mut.id}"]`);

  if (!el) {
    el = targetDoc.createElement(mut.tagName);
    el.setAttribute("data-sync-id", mut.id);
    if (mut.id) el.id = mut.id;
    targetDoc.head.appendChild(el);
  }

  if (mut.tagName === "style" && mut.content !== undefined) {
    el.textContent = mut.content;
  }
  if (mut.tagName === "link") {
    if (mut.href) el.setAttribute("href", mut.href);
    if (mut.rel) el.setAttribute("rel", mut.rel);
  }
  if (mut.attributes) {
    for (const [k, v] of Object.entries(mut.attributes)) {
      el.setAttribute(k, v);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeStyleNode(node: Node, action: "add" | "update" | "remove"): StyleElementMutation | null {
  if (!(node instanceof Element)) return null;
  const tagName = node.tagName.toUpperCase();
  if (tagName !== "STYLE" && tagName !== "LINK") return null;
  if (tagName === "LINK" && node.getAttribute("rel") !== "stylesheet") return null;

  const id = node.id || node.getAttribute("data-sync-id") || generateStableId(node);

  return {
    type: "style-element",
    action,
    id,
    tagName: tagName.toLowerCase() as "style" | "link",
    content: tagName === "STYLE" ? node.textContent ?? undefined : undefined,
    href: tagName === "LINK" ? node.getAttribute("href") ?? undefined : undefined,
    rel: tagName === "LINK" ? node.getAttribute("rel") ?? undefined : undefined,
    attributes: extractDataAttributes(node),
  };
}

function extractDataAttributes(el: Element): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};
  let hasAttrs = false;
  for (const attr of el.attributes) {
    if (attr.name.startsWith("data-") && attr.name !== "data-sync-id") {
      attrs[attr.name] = attr.value;
      hasAttrs = true;
    }
  }
  return hasAttrs ? attrs : undefined;
}

let idCounter = 0;

function generateStableId(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const href = el.getAttribute("href") ?? "";
  if (href) return `sync-${tag}-${hashString(href)}`;
  const content = el.textContent ?? "";
  if (content.length > 0) return `sync-${tag}-${hashString(content.slice(0, 200))}`;
  return `sync-${tag}-${++idCounter}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
