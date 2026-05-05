import { createContext, useContext, createElement } from "react";
import type { ReactNode } from "react";
import type { PermissionSnapshot, SentinelPrincipal } from "@sentinel-guard/core";

export interface SentinelContextValue {
  readonly snapshot: PermissionSnapshot;
  readonly principal: SentinelPrincipal;
}

export interface SentinelProviderProps {
  readonly snapshot: PermissionSnapshot;
  readonly principal: SentinelPrincipal;
  readonly children: ReactNode;
}

const SentinelContext = createContext<SentinelContextValue | null>(null);

export function SentinelProvider({
  snapshot,
  principal,
  children,
}: SentinelProviderProps): ReactNode {
  return createElement(
    SentinelContext.Provider,
    { value: { snapshot, principal } },
    children,
  );
}

export function useSentinel(): SentinelContextValue {
  const ctx = useContext(SentinelContext);
  if (!ctx) {
    throw new Error("useSentinel must be used within a SentinelProvider");
  }
  return ctx;
}
