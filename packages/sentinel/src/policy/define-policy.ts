import type { PolicyRule } from "./policy-types";

export interface PolicyConfig {
  readonly name: string;
  readonly description?: string;
  readonly rules: readonly PolicyRule[];
}

export interface Policy {
  readonly name: string;
  readonly description?: string | undefined;
  readonly rules: readonly PolicyRule[];
}

/** Define a policy. Freezes and returns the config for immutability. */
export function definePolicy(config: PolicyConfig): Policy {
  return Object.freeze({
    name: config.name,
    description: config.description,
    rules: Object.freeze([...config.rules]),
  });
}
