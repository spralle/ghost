import type { CheckContext } from "./check";
import { check } from "./check";
import type { SentinelPrincipal } from "../principal/sentinel-principal";
import type { AuditLogger } from "./audit-logger";

/** Simplified permission check — returns boolean */
export function can(
  principal: SentinelPrincipal,
  action: string,
  context: CheckContext,
  auditLogger?: AuditLogger,
): boolean {
  return check(principal, action, context, auditLogger).effect === "allow";
}
