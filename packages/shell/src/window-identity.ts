/**
 * Resolves this window's identity.
 * - Primary window: generates a fresh ID
 * - Secondary window: reads host-assigned ID from URL params
 */

import { createWindowId } from "./app/utils.js";

export interface WindowIdentity {
  readonly windowId: string;
  readonly isSecondary: boolean;
  readonly hostWindowId: string | null;
}

export function resolveWindowIdentity(): WindowIdentity {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  const assignedId = params.get("windowId");

  if (assignedId) {
    return {
      windowId: assignedId,
      isSecondary: true,
      hostWindowId: params.get("hostWindowId"),
    };
  }

  return {
    windowId: createWindowId(),
    isSecondary: false,
    hostWindowId: null,
  };
}
