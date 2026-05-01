import { useEffect, useState, type ReactNode } from "react";

export interface GhostPendingBoundaryProps {
  /** Whether navigation is pending. */
  readonly isPending: boolean;
  /** Delay in ms before showing pending component. */
  readonly pendingMs: number;
  /** Component to show while pending (after delay). */
  readonly pendingFallback?: ReactNode;
  /** The main content. */
  readonly children: ReactNode;
}

/** Wrapper that delays showing a pending state to avoid flash. */
export function GhostPendingBoundary({
  isPending,
  pendingMs,
  pendingFallback,
  children,
}: GhostPendingBoundaryProps): ReactNode {
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setShowPending(false);
      return;
    }
    const timer = setTimeout(() => setShowPending(true), pendingMs);
    return () => clearTimeout(timer);
  }, [isPending, pendingMs]);

  if (showPending && pendingFallback) {
    return pendingFallback;
  }
  return children;
}
