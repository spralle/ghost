import type {
  SentinelPrincipal,
  PermissionSnapshot,
  CheckResult,
  DerivationNode,
  CheckContext,
} from '@ghost/sentinel';

/** Store interface needed for store-based evaluation */
export interface SentinelStoreReader {
  getCompiledPolicy(tenantId: string): import('@ghost/sentinel').CompiledPolicy | undefined;
  getGraphSubset(principalId: string): import('@ghost/sentinel').GraphSubset | undefined;
}

/** How to resolve the principal from command metadata */
export interface PrincipalResolver {
  (meta: unknown): SentinelPrincipal | undefined;
}

/** How to resolve evaluation context (store-based or snapshot-based) */
export type EvaluationMode =
  | { readonly kind: 'store'; readonly store: SentinelStoreReader }
  | { readonly kind: 'snapshot'; readonly getSnapshot: (principalId: string) => PermissionSnapshot | undefined };

/** Maps command types to sentinel action names */
export type ActionMap = Readonly<Record<string, string>>;

/** Plugin configuration */
export interface SentinelPluginConfig {
  /** Maps commandType → sentinel action. Unmapped commands pass through. */
  readonly actionMap: ActionMap;
  /** Extract SentinelPrincipal from command meta. Return undefined to skip auth. */
  readonly resolvePrincipal: PrincipalResolver;
  /** Live store or snapshot mode */
  readonly mode: EvaluationMode;
  /** If true, unmapped commands are denied (default: false = passthrough) */
  readonly denyUnmapped?: boolean;
  /** If true, commands with no principal in meta are denied (default: true) */
  readonly denyAnonymous?: boolean;
  /** Custom resource builder: extracts resource context from command for policy evaluation */
  readonly buildResource?: (ctx: { aggregateId: string; commandType: string; payload: unknown }) => Record<string, unknown>;
}

/** Typed authorization error thrown when a command is denied */
export class AuthorizationError extends Error {
  readonly code = 'AUTHORIZATION_DENIED' as const;
  readonly principal: SentinelPrincipal;
  readonly action: string;
  readonly commandType: string;
  readonly aggregateId: string;
  readonly checkResult: CheckResult;
  readonly derivation?: DerivationNode;

  constructor(opts: {
    principal: SentinelPrincipal;
    action: string;
    commandType: string;
    aggregateId: string;
    checkResult: CheckResult;
    derivation?: DerivationNode;
  }) {
    super(`Authorization denied: ${opts.action} on ${opts.aggregateId} — ${opts.checkResult.reason}`);
    this.name = 'AuthorizationError';
    this.principal = opts.principal;
    this.action = opts.action;
    this.commandType = opts.commandType;
    this.aggregateId = opts.aggregateId;
    this.checkResult = opts.checkResult;
    this.derivation = opts.derivation;
  }
}
