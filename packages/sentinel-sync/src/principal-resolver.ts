import { createPrincipal } from "@ghost/sentinel";
import type { SentinelPrincipal, SentinelStore } from "@ghost/sentinel";
import type { EnrichedJwtPayload, PrincipalResolverOptions } from "./types.js";

/**
 * Resolve a JWT payload into a SentinelPrincipal.
 * Missing fields (partyIds, orgChain) are looked up from the store.
 * When the JWT is enriched with these fields, lookups short-circuit.
 */
export async function resolvePrincipal(
  jwt: EnrichedJwtPayload,
  options: PrincipalResolverOptions,
): Promise<SentinelPrincipal> {
  const { store, trustJwtPartyIds } = options;

  const partyIds = await resolvePartyIds(jwt, store, trustJwtPartyIds ?? false);
  const orgChain = await resolveOrgChain(jwt, store);
  const roles = jwt.roles ? [...jwt.roles] : await store.loadRoles(jwt.id);

  return createPrincipal({
    userId: jwt.id,
    tenantId: jwt.tenant,
    roles,
    partyIds,
    orgChain,
    claims: buildClaims(jwt),
  });
}

async function resolvePartyIds(
  jwt: EnrichedJwtPayload,
  store: SentinelStore,
  trustJwt: boolean,
): Promise<string[]> {
  if (jwt.partyIds && trustJwt) {
    return [...jwt.partyIds];
  }

  const tuples = await store.loadTuples("user", jwt.id, "partyMember");
  return tuples.map((t) => t.targetId);
}

async function resolveOrgChain(
  jwt: EnrichedJwtPayload,
  store: SentinelStore,
): Promise<string[]> {
  if (jwt.orgChain) {
    return [...jwt.orgChain];
  }

  const chain: string[] = [];
  let currentId = jwt.tenant;

  for (let depth = 0; depth < 10; depth++) {
    const tuples = await store.loadTuples("tenant", currentId, "parentOrg");
    if (tuples.length === 0) break;
    const parentId = tuples[0].targetId;
    chain.push(parentId);
    currentId = parentId;
  }

  return chain;
}

function buildClaims(jwt: EnrichedJwtPayload): Record<string, unknown> {
  return {
    source: jwt.source,
    name: jwt.name,
    surname: jwt.surname,
    emails: jwt.emails,
    ...(jwt.isOnlineOnly !== undefined && { isOnlineOnly: jwt.isOnlineOnly }),
    ...(jwt.type !== undefined && { type: jwt.type }),
    ...(jwt.impersonatedBy !== undefined && { impersonatedBy: jwt.impersonatedBy }),
  };
}
