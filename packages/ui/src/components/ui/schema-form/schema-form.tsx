"use client";

import type { RendererRegistry, UseSchemaFormOptions } from "@formbar/react";
import { renderLayoutTree, useSchemaForm } from "@formbar/react";
import { useCallback, useMemo } from "react";
import { cn } from "../../../lib/utils";
import { Button } from "../button";
import { createGhostRegistry } from "./ghost-renderers";
import { SchemaFormProvider } from "./schema-form-context";
import type { WidgetOverrides } from "./widget-overrides";

export interface SchemaFormProps {
  readonly schema: unknown;
  readonly initialData?: Record<string, unknown>;
  readonly onSubmit?: (data: unknown) => void | Promise<void>;
  readonly className?: string;
  readonly children?: React.ReactNode;
  readonly options?: Omit<UseSchemaFormOptions<unknown, unknown>, "initialData">;
  readonly registry?: RendererRegistry;
  readonly overrides?: WidgetOverrides;
}

export function SchemaForm({
  schema,
  initialData,
  onSubmit,
  className,
  children,
  options,
  registry,
  overrides,
}: SchemaFormProps) {
  const { form, fields, layout, fieldStates } = useSchemaForm(schema, {
    ...options,
    initialData: initialData as never,
  });

  const resolvedRegistry = useMemo(() => registry ?? createGhostRegistry(), [registry]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const result = await form.submit();
      if (result.ok && onSubmit) {
        await onSubmit(form.getState().data);
      }
    },
    [form, onSubmit],
  );

  return (
    <SchemaFormProvider value={{ form, fields, overrides, registry: resolvedRegistry, fieldStates }}>
      <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)} noValidate>
        {(layout.children?.map((node) => renderLayoutTree(node, resolvedRegistry)) ?? []) as React.ReactNode}
        {children ?? (
          <Button type="submit" disabled={!form.canSubmit()}>
            Submit
          </Button>
        )}
      </form>
    </SchemaFormProvider>
  );
}
