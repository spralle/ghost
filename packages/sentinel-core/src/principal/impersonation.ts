import type { SentinelPrincipal } from "./sentinel-principal.js";

/** A principal impersonating another — evaluates as target, audits as original */
export interface ImpersonatedPrincipal extends SentinelPrincipal {
  readonly impersonatedBy: {
    readonly userId: string;
    readonly tenantId: string;
    readonly reason: string;
    readonly startedAt: number; // epoch ms
  };
}

/** Create an impersonation principal. The resulting principal has the TARGET's identity
 *  but carries audit metadata from the ORIGINAL. */
export function impersonate(
  original: SentinelPrincipal,
  target: SentinelPrincipal,
  reason: string,
): ImpersonatedPrincipal {
  return Object.freeze({
    userId: target.userId,
    tenantId: target.tenantId,
    roles: Object.freeze([...target.roles]),
    partyIds: Object.freeze([...target.partyIds]),
    orgChain: Object.freeze([...target.orgChain]),
    ...(target.claims !== undefined && { claims: Object.freeze({ ...target.claims }) }),
    impersonatedBy: Object.freeze({
      userId: original.userId,
      tenantId: original.tenantId,
      reason,
      startedAt: Date.now(),
    }),
  });
}

/** Type guard — is this principal impersonating? */
export function isImpersonated(principal: SentinelPrincipal): principal is ImpersonatedPrincipal {
  return "impersonatedBy" in principal;
}
