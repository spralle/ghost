import type { PolicyEffect } from "../policy/policy-types";

/** The kind of target a stored policy rule applies to */
export type PolicyTargetKind = "action" | "dataBlock";

/** A stored relationship tuple between nodes */
export interface RelationTuple {
  readonly nodeType: string;
  readonly nodeId: string;
  readonly relation: string;
  readonly targetType: string;
  readonly targetId: string;
}

/** A stored policy rule for a resource type */
export interface PolicyRule {
  readonly resourceType: string;
  readonly action: string;
  readonly condition: unknown;
  readonly effect: PolicyEffect;
  readonly salience?: number;
  readonly targetKind?: PolicyTargetKind;
  readonly block?: string;
}

/** Flat tuple returned from storage (no nested objects) */
export interface StoreTuple {
  readonly nodeType: string;
  readonly nodeId: string;
  readonly relation: string;
  readonly targetType: string;
  readonly targetId: string;
}

/** Minimal read interface for Sentinel storage — shape only, no implementation */
export interface SentinelStore {
  /**
   * Load all relation tuples matching the given node and relation.
   * @returns Matching tuples, or an empty array if none exist. Never returns undefined.
   * @throws Implementation-defined errors on storage failure (e.g. connection loss).
   */
  loadTuples(nodeType: string, nodeId: string, relation: string): Promise<RelationTuple[]>;

  /**
   * Load all outbound tuples from a node across all relations.
   * @returns All tuples where the node is the source. Empty array if none exist.
   */
  loadTuplesFrom(node: { readonly type: string; readonly id: string }): Promise<StoreTuple[]>;

  /**
   * Load all policy rules defined for a resource type.
   * @returns All matching policy rules, or an empty array if none are defined.
   */
  loadPolicies(resourceType: string): Promise<PolicyRule[]>;

  /**
   * Load all role IDs assigned to a principal.
   * @returns Array of role ID strings, or an empty array if the principal has no roles.
   */
  loadRoles(principalId: string): Promise<string[]>;
}

/** Write interface for Sentinel storage — extends read with mutation operations */
export interface SentinelWriteStore extends SentinelStore {
  /**
   * Add a single relation tuple. Idempotent — adding a duplicate tuple is a no-op.
   * @returns this (for chaining) or a Promise resolving to this.
   */
  addTuple(tuple: RelationTuple): this | Promise<this>;

  /**
   * Add multiple relation tuples. Idempotent per tuple.
   * @returns this (for chaining) or a Promise resolving to this.
   */
  addTuples(tuples: readonly RelationTuple[]): this | Promise<this>;

  /**
   * Remove a single relation tuple. No-op if the tuple does not exist.
   * @returns this (for chaining) or a Promise resolving to this.
   */
  removeTuple(tuple: RelationTuple): this | Promise<this>;

  /**
   * Add a single policy rule. Idempotent — adding a duplicate rule is a no-op.
   * @returns this (for chaining) or a Promise resolving to this.
   */
  addPolicy(policy: PolicyRule): this | Promise<this>;

  /**
   * Add multiple policy rules. Idempotent per rule.
   * @returns this (for chaining) or a Promise resolving to this.
   */
  addPolicies(policies: readonly PolicyRule[]): this | Promise<this>;

  /**
   * Remove the policy rule matching the given resource type and action.
   * No-op if no matching rule exists.
   * @returns this (for chaining) or a Promise resolving to this.
   */
  removePolicy(resourceType: string, action: string): this | Promise<this>;

  /**
   * Set the complete list of roles for a principal, replacing any existing roles.
   * Pass an empty array to clear all roles.
   * @returns this (for chaining) or a Promise resolving to this.
   */
  setRoles(principalId: string, roles: readonly string[]): this | Promise<this>;

  /**
   * Remove all roles for a principal. No-op if the principal has no roles.
   * @returns this (for chaining) or a Promise resolving to this.
   */
  removeRoles(principalId: string): this | Promise<this>;

  /** Remove all tuples, policies, and roles from the store. */
  clear(): void | Promise<void>;
}
