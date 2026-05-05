import { FromSchemaError } from "../errors.js";
import { isBuiltInNodeType, type LayoutNode } from "./layout-types.js";

export interface LayoutNodeDefinition {
  readonly type: string;
  readonly rendererKey: string;
}

export class LayoutNodeRegistry {
  private readonly custom = new Map<string, LayoutNodeDefinition>();

  /** Register a custom node type. Built-in types cannot be overridden. */
  register(type: string, definition: LayoutNodeDefinition): void {
    if (isBuiltInNodeType(type)) {
      throw new FromSchemaError("FORMBAR_LAYOUT_UNKNOWN_NODE_TYPE", `Cannot override built-in layout node type: ${type}`);
    }
    this.custom.set(type, definition);
  }

  /** Get a custom node definition, or undefined if not registered. */
  get(type: string): LayoutNodeDefinition | undefined {
    return this.custom.get(type);
  }

  /** Check if a node type is known (built-in or registered). */
  has(type: string): boolean {
    return isBuiltInNodeType(type) || this.custom.has(type);
  }

  /** Walk a layout tree and throw for each unknown node type. */
  validate(tree: LayoutNode): void {
    if (!this.has(tree.type)) {
      throw new FromSchemaError("FORMBAR_LAYOUT_UNKNOWN_NODE_TYPE", `Unknown layout node type: ${tree.type}`);
    }
    if (tree.children) {
      for (const child of tree.children) {
        this.validate(child);
      }
    }
  }
}
