/**
 * Utilities for capturing and transferring part snapshots during popout.
 */

import { isSnapshotCapable } from "@ghost-shell/contracts";

export interface PartSnapshot {
  partId: string;
  pluginId: string;
  snapshot: unknown;
  capturedAt: number;
}

/**
 * Attempt to capture a snapshot from a part instance.
 * Returns null if the part doesn't implement SnapshotCapable.
 */
export function capturePartSnapshot(
  partId: string,
  pluginId: string,
  partInstance: unknown,
): PartSnapshot | null {
  if (!isSnapshotCapable(partInstance)) return null;

  try {
    const snapshot = partInstance.getSnapshot();
    return {
      partId,
      pluginId,
      snapshot,
      capturedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Attempt to restore a snapshot to a part instance.
 * No-op if part doesn't implement SnapshotCapable or snapshot is null.
 */
export function restorePartSnapshot(
  partInstance: unknown,
  snapshot: PartSnapshot | null | undefined,
): boolean {
  if (!snapshot) return false;
  if (!isSnapshotCapable(partInstance)) return false;

  try {
    partInstance.restoreSnapshot(snapshot.snapshot);
    return true;
  } catch {
    return false;
  }
}
