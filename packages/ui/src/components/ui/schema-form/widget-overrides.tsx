import type { SchemaFieldType } from "@formbar/from-schema";
import type { ComponentType } from "react";
import type { WidgetProps } from "./ghost-widgets";
import { GHOST_DEFAULT_WIDGETS } from "./ghost-widgets";

export interface WidgetOverrides {
  readonly paths?: Readonly<Record<string, ComponentType<WidgetProps>>>;
  readonly types?: Partial<Readonly<Record<SchemaFieldType, ComponentType<WidgetProps>>>>;
  readonly widgets?: Partial<Readonly<Record<string, ComponentType<WidgetProps>>>>;
}

/** Resolve widget component: path > schema type > widget name > Ghost default */
export function resolveWidget(
  path: string,
  schemaType: SchemaFieldType,
  widgetName: string,
  overrides?: WidgetOverrides,
): ComponentType<WidgetProps> | undefined {
  if (overrides?.paths?.[path]) return overrides.paths[path];
  if (overrides?.types?.[schemaType]) return overrides.types[schemaType];
  if (overrides?.widgets?.[widgetName]) return overrides.widgets[widgetName];
  return GHOST_DEFAULT_WIDGETS[widgetName];
}
