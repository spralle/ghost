"use client";

import type { LayoutNode } from "@formbar/from-schema";
import type { LayoutRendererProps } from "@formbar/react";
import { descriptionId, errorId, fieldId, RendererRegistry, renderLayoutTree } from "@formbar/react";
import type { ReactNode } from "react";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "../field";
import { mapFieldToWidget } from "./field-mapping";
import { useFieldState, useSchemaFormContext } from "./schema-form-context";
import { resolveWidget } from "./widget-overrides";

function getNodeProp(node: LayoutNode, key: string): unknown {
  return (node.props as Readonly<Record<string, unknown>> | undefined)?.[key];
}

function capitalize(s: string): string {
  const last = s.split(".").pop() ?? s;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function GhostFieldRenderer({ node }: LayoutRendererProps): ReactNode {
  const { form, fields, overrides } = useSchemaFormContext();
  const fieldInfo = fields.find((f) => f.path === node.path);
  const fieldState = useFieldState(node.path ?? "");
  if (!fieldInfo || !node.path) return null;

  const isReadOnly = fieldInfo.metadata?.readOnly === true || fieldState.readOnly;
  const isDisabled = fieldState.disabled;

  const fieldApi = form.field(node.path as never);
  const mapping = mapFieldToWidget(fieldInfo);
  const Widget = resolveWidget(node.path, fieldInfo.type, mapping.widget, overrides);
  if (!Widget) return null;

  const issues = fieldApi.issues();
  const errorIssues = issues.filter((i) => i.severity === "error");
  const hasErrors = errorIssues.length > 0;
  const hasDescription = !!fieldInfo.metadata?.description;
  const title = fieldInfo.metadata?.title ?? fieldInfo.metadata?.label ?? capitalize(node.path);
  const id = fieldId(node.path);

  const describedByParts: string[] = [];
  if (hasDescription) describedByParts.push(descriptionId(node.path));
  if (hasErrors) describedByParts.push(errorId(node.path));
  const ariaDescribedBy = describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

  const aria = {
    id,
    ...(hasErrors ? { "aria-invalid": true as const } : {}),
    ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
    ...(fieldInfo.required ? { "aria-required": true as const } : {}),
  };

  return (
    <Field data-invalid={hasErrors || undefined}>
      <FieldLabel htmlFor={id}>{title}</FieldLabel>
      <Widget
        field={fieldApi}
        fieldInfo={fieldInfo}
        mapping={mapping}
        aria={aria}
        readOnly={isReadOnly}
        disabled={isDisabled}
      />
      {hasDescription && (
        <FieldDescription id={descriptionId(node.path)}>{fieldInfo.metadata?.description}</FieldDescription>
      )}
      {hasErrors && <FieldError id={errorId(node.path)}>{errorIssues.map((i) => i.message).join(", ")}</FieldError>}
    </Field>
  );
}

function GhostGroupRenderer({ node, children }: LayoutRendererProps): ReactNode {
  const title = getNodeProp(node, "title") as string | undefined;
  return (
    <FieldGroup>
      {title && <FieldLegend>{title}</FieldLegend>}
      {children as ReactNode}
    </FieldGroup>
  );
}

function GhostSectionRenderer({ node, children }: LayoutRendererProps): ReactNode {
  const title = getNodeProp(node, "title") as string | undefined;
  const description = getNodeProp(node, "description") as string | undefined;
  return (
    <FieldSet>
      {title && <FieldLegend>{title}</FieldLegend>}
      {description && <FieldDescription>{description}</FieldDescription>}
      {children as ReactNode}
    </FieldSet>
  );
}

function GhostArrayRenderer({ node }: LayoutRendererProps): ReactNode {
  const { form, registry } = useSchemaFormContext();
  if (!node.path) return null;

  const fieldApi = form.field(node.path as never);
  const arrayValue = (fieldApi.get() ?? []) as readonly unknown[];
  const title = getNodeProp(node, "title") as string | undefined;
  const maxItems = getNodeProp(node, "maxItems") as number | undefined;
  const canAdd = maxItems === undefined || arrayValue.length < maxItems;

  const hasArrayHelpers = typeof (fieldApi as unknown as Record<string, unknown>)["pushValue"] === "function";
  const arrayHelpers = fieldApi as unknown as {
    pushValue(item: unknown): unknown;
    removeValue(index: number): unknown;
  };

  return (
    <FieldSet>
      <div className="flex items-center justify-between">
        {title && <FieldLegend>{title}</FieldLegend>}
        {canAdd && hasArrayHelpers && (
          <Button type="button" variant="outline" size="sm" onClick={() => arrayHelpers.pushValue(undefined)}>
            Add
          </Button>
        )}
      </div>
      {arrayValue.map((_, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1">
            {
              (node.children?.map((child) => {
                const indexedPath = child.path
                  ? child.path.replace(`${node.path}.`, `${node.path}.${index}.`)
                  : child.path;
                const indexedChild: LayoutNode = {
                  ...child,
                  id: `${child.id}-${index}`,
                  ...(indexedPath !== undefined ? { path: indexedPath } : {}),
                };
                return renderLayoutTree(indexedChild, registry);
              }) ?? []) as ReactNode
            }
          </div>
          {hasArrayHelpers && (
            <Button type="button" variant="ghost" size="sm" onClick={() => arrayHelpers.removeValue(index)}>
              Remove
            </Button>
          )}
        </div>
      ))}
    </FieldSet>
  );
}

export function createGhostRegistry(): RendererRegistry {
  const registry = new RendererRegistry();
  registry.register({ type: "field", component: GhostFieldRenderer });
  registry.register({ type: "group", component: GhostGroupRenderer });
  registry.register({ type: "section", component: GhostSectionRenderer });
  registry.register({ type: "array", component: GhostArrayRenderer });
  return registry;
}
