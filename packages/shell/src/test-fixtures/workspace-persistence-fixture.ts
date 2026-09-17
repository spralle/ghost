import { createLocalStorageWorkspacePersistence, type StorageLike } from "@ghost-shell/persistence";
import { createInitialWorkspaceManagerState, type ShellContextState } from "@ghost-shell/state";
import type { ShellRuntime } from "../app/types.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

export function createWorkspacePersistenceFixture(
  contextState: ShellContextState,
  userId = "test-user",
): Pick<ShellRuntime, "workspaceManager" | "workspacePersistence"> {
  const storage = new MemoryStorage();
  return {
    workspaceManager: createInitialWorkspaceManagerState(contextState),
    workspacePersistence: createLocalStorageWorkspacePersistence(storage, { userId }),
  };
}
