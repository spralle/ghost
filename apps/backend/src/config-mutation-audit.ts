import type { PolicyEvaluationContext } from "@weaver/config-policy";
import { type PolicyCheckDeps, recordAudit, recordOverride } from "./config-auth.js";
import type { ConfigurationPropertySchema } from "./config-stubs.js";

export type ConfigMutation =
  | { readonly action: "set"; readonly key: string; readonly tenantId: string; readonly value: unknown }
  | { readonly action: "remove"; readonly key: string; readonly tenantId: string };

export async function auditConfigMutation(
  deps: PolicyCheckDeps,
  context: PolicyEvaluationContext,
  schema: ConfigurationPropertySchema | undefined,
  mutation: ConfigMutation,
): Promise<void> {
  const changePolicy = schema?.["x-weaver"]?.changePolicy;
  const isEmergency = context.sessionMode === "emergency-override" && changePolicy === "emergency-override";

  await recordAudit(deps, {
    timestamp: new Date().toISOString(),
    actor: context.userId,
    action: mutation.action,
    key: mutation.key,
    layer: "tenant",
    tenantId: mutation.tenantId,
    newValue: mutation.action === "set" ? mutation.value : undefined,
    changePolicy,
    isEmergencyOverride: isEmergency,
    overrideReason: isEmergency ? context.overrideReason : undefined,
  });

  if (mutation.action !== "set" || !isEmergency || context.overrideReason === undefined) {
    return;
  }

  await recordOverride(deps, {
    key: mutation.key,
    actor: context.userId,
    reason: context.overrideReason,
    tenantId: mutation.tenantId,
    layer: "tenant",
  });
}
