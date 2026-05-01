import type { NavigationTarget } from "./types.js";

/**
 * Result of a navigation guard evaluation.
 * Guards can allow, block (with reason), or redirect navigation.
 */
export type NavigationGuardResult =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: string; readonly redirect?: NavigationTarget };

/**
 * A navigation guard function that evaluates whether navigation should proceed.
 */
export type NavigationGuard = (
  target: NavigationTarget,
) => NavigationGuardResult | Promise<NavigationGuardResult>;
