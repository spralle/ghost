/** Structured audit logging for authorization decisions */

export interface AuditEntry {
  readonly principal: string;
  readonly action: string;
  readonly resource?: string;
  readonly effect: string;
  readonly matchedRules: readonly string[];
  readonly timestamp: number;
}

export interface AuditLogger {
  readonly logDecision: (entry: AuditEntry) => void;
}
