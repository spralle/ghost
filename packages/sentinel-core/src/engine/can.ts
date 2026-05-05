import type { CheckContext } from "./check.js";
import { check } from "./check.js";
import type { SentinelPrincipal } from "../principal/sentinel-principal.js";

/** Simplified permission check — returns boolean */
export function can(
  principal: SentinelPrincipal,
  action: string,
  context: CheckContext,
): boolean {
  return check(principal, action, context).effect === "allow";
}
