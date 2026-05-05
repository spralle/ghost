/** Identity used for permission evaluation */
export interface SentinelPrincipal {
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly partyIds: readonly string[];
  readonly orgChain: readonly string[];
  readonly claims?: Readonly<Record<string, unknown>>;
}

/** Create a frozen SentinelPrincipal */
export function createPrincipal(config: SentinelPrincipal): SentinelPrincipal {
  return Object.freeze({
    userId: config.userId,
    tenantId: config.tenantId,
    roles: Object.freeze([...config.roles]),
    partyIds: Object.freeze([...config.partyIds]),
    orgChain: Object.freeze([...config.orgChain]),
    ...(config.claims !== undefined && { claims: Object.freeze({ ...config.claims }) }),
  });
}
