import type { JsonFormLayoutNode, JsonFormSchema } from "@ghost-shell/contracts";
import type { FormApi } from "@formbar/core";
import type { LayoutNode, SchemaFieldInfo } from "@formbar/from-schema";
import { compileLayout, ingestSchema } from "@formbar/from-schema";
import { useForm } from "@formbar/react";
import { FieldGroup } from "@ghost-shell/ui";
import type { ReactElement } from "react";
import { useMemo } from "react";
import { FormField } from "./FormField.js";

interface JsonFormRootProps {
  readonly schema: JsonFormSchema;
  readonly data: Readonly<Record<string, unknown>>;
  readonly onChange: (path: string, value: unknown) => void;
  readonly layout?: JsonFormLayoutNode;
}

interface SchemaPanelProps {
  readonly title: string;
  readonly value: unknown;
}

function SchemaPanel({ title, value }: SchemaPanelProps) {
  return (
    <details open className="rounded-md border border-[var(--ghost-border)]">
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-[var(--ghost-text-primary)]">
        {title}
      </summary>
      <pre className="max-h-64 overflow-auto px-4 pb-3 text-xs text-[var(--ghost-text-secondary)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function renderNode(
  node: LayoutNode,
  fieldMap: ReadonlyMap<string, SchemaFieldInfo>,
  form: FormApi<unknown, unknown>,
  onChange: (path: string, value: unknown) => void,
): ReactElement | null {
  if (node.type === "field") {
    const fieldInfo = node.path ? fieldMap.get(node.path) : undefined;
    if (!fieldInfo) return null;
    return <FormField key={node.id} form={form} field={fieldInfo} onChange={onChange} />;
  }

  const children = node.children?.map((child) => renderNode(child, fieldMap, form, onChange));

  if (node.type === "section") {
    const title = node.props?.title as string | undefined;
    return (
      <div key={node.id} className="flex flex-col gap-3">
        {title ? <h3 className="text-sm font-semibold text-[var(--ghost-text-primary)]">{title}</h3> : null}
        <FieldGroup>{children}</FieldGroup>
      </div>
    );
  }

  return <FieldGroup key={node.id}>{children}</FieldGroup>;
}

export function JsonFormRoot({ schema, data, onChange, layout }: JsonFormRootProps) {
  const ingestion = useMemo(() => ingestSchema(schema), [schema]);

  const compiledLayout = useMemo(
    () => compileLayout(ingestion, layout ? { overrideLayout: layout as LayoutNode } : undefined),
    [ingestion, layout],
  );

  const fieldMap = useMemo(() => {
    const map = new Map<string, SchemaFieldInfo>();
    for (const field of ingestion.fields) {
      map.set(field.path, field);
    }
    return map;
  }, [ingestion.fields]);

  const form = useForm({
    initialData: { ...data } as Record<string, unknown>,
  });

  return (
    <div className="flex flex-col gap-4">
      <SchemaPanel title="JSON Schema Input" value={schema} />
      <SchemaPanel title="Ingested Fields (layout)" value={ingestion.fields} />
      <SchemaPanel title="Compiled Layout Tree" value={compiledLayout} />
      {renderNode(compiledLayout, fieldMap, form as FormApi<unknown, unknown>, onChange)}
    </div>
  );
}
