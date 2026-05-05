export interface ListenerEntry {
  readonly path: string;
  readonly trigger: "change" | "blur";
}

export function createListenerRegistry() {
  const registry = new Map<string, Set<ListenerEntry>>();

  return {
    register(
      fieldPath: string,
      triggers: { readonly onChangeListenTo?: readonly string[]; readonly onBlurListenTo?: readonly string[] },
    ): void {
      for (const source of triggers.onChangeListenTo ?? []) {
        if (!registry.has(source)) registry.set(source, new Set());
        registry.get(source)?.add({ path: fieldPath, trigger: "change" });
      }
      for (const source of triggers.onBlurListenTo ?? []) {
        if (!registry.has(source)) registry.set(source, new Set());
        registry.get(source)?.add({ path: fieldPath, trigger: "blur" });
      }
    },

    getListeners(sourcePath: string, trigger: "change" | "blur"): readonly ListenerEntry[] {
      const entries = registry.get(sourcePath);
      if (!entries) return [];
      return [...entries].filter((e) => e.trigger === trigger);
    },

    clear(): void {
      registry.clear();
    },
  };
}
