import type { ReactElement, ReactNode } from "react";

export interface GovernanceFieldRendererProps {
  readonly changePolicy?: string;
  readonly maxOverrideLayer?: string;
  readonly reloadBehavior?: string;
  readonly sensitive?: boolean;
  readonly visibility?: string;
  readonly children: ReactNode;
}

const wrapperStyle: React.CSSProperties = {
  border: "1px solid var(--ghost-border-subtle)",
  borderRadius: "var(--ghost-radius-sm)",
  padding: "var(--ghost-spacing-sm)",
  position: "relative",
};

const badgeContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "var(--ghost-spacing-xs)",
  flexWrap: "wrap",
  marginBottom: "var(--ghost-spacing-xs)",
};

const badgeBaseStyle: React.CSSProperties = {
  fontSize: "var(--ghost-font-size-xs)",
  padding: "2px 6px",
  borderRadius: "var(--ghost-radius-xs)",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
};

const policyBadgeStyle: React.CSSProperties = {
  ...badgeBaseStyle,
  backgroundColor: "var(--ghost-surface-warning)",
  color: "var(--ghost-text-warning)",
};

const lockBadgeStyle: React.CSSProperties = {
  ...badgeBaseStyle,
  backgroundColor: "var(--ghost-surface-info)",
  color: "var(--ghost-text-info)",
};

const reloadBadgeStyle: React.CSSProperties = {
  ...badgeBaseStyle,
  backgroundColor: "var(--ghost-surface-caution)",
  color: "var(--ghost-text-caution)",
};

const sensitiveBadgeStyle: React.CSSProperties = {
  ...badgeBaseStyle,
  backgroundColor: "var(--ghost-surface-danger)",
  color: "var(--ghost-text-danger)",
};

function formatPolicyLabel(policy: string): string {
  return policy.replace(/-/g, " ");
}

/**
 * Renders governance chrome around a form field, showing
 * policy badges, ceiling locks, reload warnings, and sensitive indicators.
 */
export function GovernanceFieldRenderer(props: GovernanceFieldRendererProps): ReactElement {
  const { changePolicy, maxOverrideLayer, reloadBehavior, sensitive, children } = props;
  const hasBadges =
    changePolicy !== undefined ||
    maxOverrideLayer !== undefined ||
    (reloadBehavior !== undefined && reloadBehavior !== "none") ||
    sensitive === true;

  return (
    <div style={wrapperStyle} data-testid="governance-field">
      {hasBadges && (
        <div style={badgeContainerStyle} data-testid="governance-badges">
          {changePolicy !== undefined && changePolicy !== "direct-allowed" && (
            <span style={policyBadgeStyle} data-testid="policy-badge">
              {formatPolicyLabel(changePolicy)}
            </span>
          )}
          {maxOverrideLayer !== undefined && (
            <span style={lockBadgeStyle} data-testid="ceiling-badge">
              🔒 ceiling: {maxOverrideLayer}
            </span>
          )}
          {reloadBehavior !== undefined && reloadBehavior !== "none" && (
            <span style={reloadBadgeStyle} data-testid="reload-badge">
              ⚠ {formatPolicyLabel(reloadBehavior)}
            </span>
          )}
          {sensitive === true && (
            <span style={sensitiveBadgeStyle} data-testid="sensitive-badge">
              🛡 sensitive
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export const governanceFieldEntry = {
  type: "governance-field" as const,
  component: GovernanceFieldRenderer,
};
