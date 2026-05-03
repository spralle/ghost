import type { ReactNode } from "react";
import { useCan } from "./use-can";

export interface PermissionGateProps {
  readonly action: string;
  readonly resource?: Record<string, unknown>;
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}

export function PermissionGate({
  action,
  resource,
  fallback,
  children,
}: PermissionGateProps): ReactNode {
  const { allowed } = useCan(action, resource);

  if (allowed) {
    return children;
  }
  return fallback ?? null;
}
