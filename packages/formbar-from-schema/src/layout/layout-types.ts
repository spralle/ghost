export type BuiltInLayoutNodeType = "group" | "section" | "field" | "array";
export type LayoutNodeType = BuiltInLayoutNodeType | (string & {});

export interface LayoutNode {
  readonly type: LayoutNodeType;
  readonly id: string;
  readonly children?: readonly LayoutNode[];
  readonly path?: string;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly role?: string;
  readonly ariaLabel?: string;
}

export interface SectionNodeProps {
  readonly title?: string;
  readonly description?: string;
  readonly columns?: number;
}

export interface GroupNodeProps {
  readonly title?: string;
  readonly columns?: number;
}

export type FieldNodeProps = Record<string, never>;

export interface ArrayNodeProps {
  readonly title?: string;
  readonly minItems?: number;
  readonly maxItems?: number;
}

export type SectionNode = LayoutNode & { readonly type: "section"; readonly props?: Readonly<SectionNodeProps> };
export type GroupNode = LayoutNode & { readonly type: "group"; readonly props?: Readonly<GroupNodeProps> };
export type FieldNode = LayoutNode & { readonly type: "field"; readonly path: string };
export type ArrayNode = LayoutNode & {
  readonly type: "array";
  readonly path: string;
  readonly props?: Readonly<ArrayNodeProps>;
};

const BUILT_IN_TYPES: ReadonlySet<string> = new Set<BuiltInLayoutNodeType>(["group", "section", "field", "array"]);

export function isBuiltInNodeType(type: string): type is BuiltInLayoutNodeType {
  return BUILT_IN_TYPES.has(type);
}

export function isFieldNode(node: LayoutNode): node is FieldNode {
  return node.type === "field";
}

export function isArrayNode(node: LayoutNode): node is ArrayNode {
  return node.type === "array";
}

export function isGroupNode(node: LayoutNode): node is GroupNode {
  return node.type === "group";
}

export function isSectionNode(node: LayoutNode): node is SectionNode {
  return node.type === "section";
}
