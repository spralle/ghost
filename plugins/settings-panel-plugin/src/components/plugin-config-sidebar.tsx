// plugin-config-sidebar.tsx — Searchable list of configurable plugins.

import { useState, useMemo, useCallback } from "react";
import type { PluginRegistryEntry } from "@ghost-shell/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginConfigSidebarProps {
  readonly plugins: readonly PluginRegistryEntry[];
  readonly selectedPluginId: string | null;
  readonly onSelectPlugin: (pluginId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a human-readable name from a plugin ID (e.g. "ghost.motion" → "Motion"). */
function displayName(entry: PluginRegistryEntry): string {
  if (entry.name && entry.name !== entry.pluginId) return entry.name;
  const parts = entry.pluginId.split(".");
  const last = parts[parts.length - 1] ?? entry.pluginId;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginConfigSidebar({
  plugins,
  selectedPluginId,
  onSelectPlugin,
}: PluginConfigSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return plugins;
    const lower = search.toLowerCase();
    return plugins.filter((p) => {
      const name = displayName(p).toLowerCase();
      return name.includes(lower) || p.pluginId.toLowerCase().includes(lower);
    });
  }, [plugins, search]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    [],
  );

  return (
    <nav
      aria-label="Configurable plugins"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: "200px",
        borderRight: "1px solid var(--ghost-border)",
        padding: "8px",
      }}
    >
      <input
        type="search"
        placeholder="Filter plugins…"
        value={search}
        onChange={handleSearchChange}
        aria-label="Filter plugins"
        style={{
          padding: "6px 8px",
          fontSize: "13px",
          border: "1px solid var(--ghost-border)",
          borderRadius: "4px",
          background: "var(--ghost-input)",
          color: "var(--ghost-foreground)",
          marginBottom: "4px",
          outline: "none",
        }}
      />
      {filtered.length === 0 && (
        <p
          style={{
            fontSize: "12px",
            color: "var(--ghost-muted-foreground)",
            padding: "8px 4px",
          }}
        >
          No configurable plugins found.
        </p>
      )}
      {filtered.map((plugin) => {
        const isSelected = plugin.pluginId === selectedPluginId;
        return (
          <button
            key={plugin.pluginId}
            type="button"
            onClick={() => onSelectPlugin(plugin.pluginId)}
            aria-current={isSelected ? "true" : undefined}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              fontSize: "13px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: isSelected
                ? "var(--ghost-accent)"
                : "transparent",
              color: isSelected
                ? "var(--ghost-accent-foreground)"
                : "var(--ghost-foreground)",
            }}
          >
            <span style={{ fontWeight: 500 }}>{displayName(plugin)}</span>
            <span
              style={{
                display: "block",
                fontSize: "11px",
                color: isSelected
                  ? "var(--ghost-accent-foreground)"
                  : "var(--ghost-muted-foreground)",
                opacity: 0.8,
              }}
            >
              {plugin.pluginId}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
