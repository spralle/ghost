const HMR_WINDOW_REGISTRY_KEY = "__ghostShellHmrRegistry";

interface ShellMountRecord {
  readonly windowId: string;
  dispose(): void;
}

export interface ShellHmrRegistry {
  readonly byRoot: WeakMap<HTMLElement, ShellMountRecord>;
  readonly windowIds: Set<string>;
}

export function getShellHmrRegistry(): ShellHmrRegistry {
  const scope = globalThis as typeof globalThis & {
    [HMR_WINDOW_REGISTRY_KEY]?: ShellHmrRegistry;
  };

  scope[HMR_WINDOW_REGISTRY_KEY] ??= {
    byRoot: new WeakMap<HTMLElement, ShellMountRecord>(),
    windowIds: new Set<string>(),
  };

  return scope[HMR_WINDOW_REGISTRY_KEY];
}
