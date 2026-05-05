import type { SchemaFieldInfo, SchemaIngestionResult } from "@ghost-shell/schema-core";
import type { LayoutNode } from "./layout-types.js";

export interface LayoutCompileOptions {
  readonly overrideLayout?: LayoutNode;
}

/**
 * Compile a SchemaIngestionResult into a LayoutNode tree.
 * Flat field paths are reconstructed into a nested tree structure.
 */
export function compileLayout(result: SchemaIngestionResult, options?: LayoutCompileOptions): LayoutNode {
  if (options?.overrideLayout) {
    return options.overrideLayout;
  }

  const children = buildTreeFromFields(result.fields);

  return {
    type: "group",
    id: "layout-root",
    role: "group",
    children,
  };
}

interface TreeEntry {
  readonly segment: string;
  readonly field?: SchemaFieldInfo;
  readonly children: TreeEntry[];
}

/** Group flat fields by path segments to reconstruct nesting. */
function buildTreeFromFields(fields: readonly SchemaFieldInfo[]): readonly LayoutNode[] {
  const root: TreeEntry[] = [];

  for (const field of fields) {
    insertField(root, field, field.path.split("."), 0);
  }

  return root.map((entry) => treeEntryToNode(entry, ""));
}

function insertField(entries: TreeEntry[], field: SchemaFieldInfo, segments: readonly string[], depth: number): void {
  if (depth === segments.length - 1) {
    entries.push({ segment: segments[depth], field, children: [] });
    return;
  }

  const segment = segments[depth];
  let existing = entries.find((e) => e.segment === segment && (!e.field || e.field.type === "array"));

  if (!existing) {
    const entry: TreeEntry = { segment, children: [] };
    entries.push(entry);
    existing = entry;
  }

  insertField(existing.children, field, segments, depth + 1);
}

function treeEntryToNode(entry: TreeEntry, parentPath: string): LayoutNode {
  const currentPath = parentPath ? `${parentPath}.${entry.segment}` : entry.segment;

  if (entry.field) {
    if (entry.field.type === "array") {
      return buildArrayNode(entry, currentPath);
    }
    return {
      type: "field",
      id: `layout-${currentPath}`,
      path: currentPath,
    };
  }

  // Intermediate group node
  return {
    type: "group",
    id: `layout-${currentPath}`,
    role: "group",
    children: entry.children.map((child) => treeEntryToNode(child, currentPath)),
  };
}

function buildArrayNode(entry: TreeEntry, currentPath: string): LayoutNode {
  const templateChildren: readonly LayoutNode[] =
    entry.children.length > 0
      ? entry.children.map((child) => treeEntryToNode(child, currentPath))
      : [{ type: "field" as const, id: `layout-${currentPath}-item`, path: `${currentPath}[]` }];

  return {
    type: "array",
    id: `layout-${currentPath}`,
    path: currentPath,
    children: templateChildren,
  };
}
