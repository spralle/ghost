import type { PermissionGrant } from "./types";
import type { PolicyRule } from "@ghost/sentinel";
import { SALIENCE } from "@ghost/sentinel";

/** Convert permission grants from a resolved role into PolicyRules */
export function grantsToPolicyRules(
  grants: readonly PermissionGrant[],
  roleName: string,
): PolicyRule[] {
  return grants.map((grant) => ({
    name: `role:${roleName}:${grant.action}`,
    effect: "grant" as const,
    target: { kind: "action" as const, action: grant.action },
    condition: (grant.condition as Record<string, unknown>) ?? {},
    salience: SALIENCE.grant,
  }));
}
