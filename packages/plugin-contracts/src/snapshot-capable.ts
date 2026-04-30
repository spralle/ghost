/**
 * Interface for parts that support state snapshot/restore.
 * When a part is popped out to a secondary window, the host calls getSnapshot()
 * before detach, transfers the snapshot, and the secondary calls restoreSnapshot()
 * on mount — preserving visual and data continuity.
 */

/** Marker + contract for parts that can snapshot/restore their state */
export interface SnapshotCapable {
  /** Capture current state as a serializable snapshot */
  getSnapshot(): unknown;
  /** Restore state from a previously captured snapshot */
  restoreSnapshot(snapshot: unknown): void;
}

/** Type guard to check if a part implements SnapshotCapable */
export function isSnapshotCapable(part: unknown): part is SnapshotCapable {
  if (!part || typeof part !== "object") return false;
  const candidate = part as Record<string, unknown>;
  return typeof candidate.getSnapshot === "function" && typeof candidate.restoreSnapshot === "function";
}
