import type { FormApi } from "@formbar/core";
import type { SchemaFieldInfo } from "@formbar/from-schema";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Switch,
} from "@ghost-shell/ui";
import { useCallback, useEffect, useRef, useState } from "react";

interface FormFieldProps {
  readonly form: FormApi<unknown, unknown>;
  readonly field: SchemaFieldInfo;
  readonly onChange: (path: string, value: unknown) => void;
}

/**
 * Uses local React state instead of useSyncExternalStore to drive re-renders.
 * This avoids a reactivity gap where formbar's store notifications (bundled in the
 * plugin) fail to trigger React's (shared via Module Federation) re-render cycle.
 */
export function FormField({ form, field, onChange }: FormFieldProps) {
  const fieldApiRef = useRef(form.field(field.path));
  const fieldApi = fieldApiRef.current;
  const [value, setValue] = useState<unknown>(() => fieldApi.get());
  const id = `field-${field.path}`;

  // Sync from store → local state via manual subscription
  useEffect(() => {
    return form.subscribe(() => {
      const storeValue: unknown = fieldApi.get();
      setValue((prev: unknown) => (Object.is(prev, storeValue) ? prev : storeValue));
    });
  }, [form, fieldApi]);

  const handleChange = useCallback(
    (newValue: unknown) => {
      try {
        fieldApi.set(newValue as never);
      } catch (err) {
        console.warn("[FormField] set error:", field.path, err);
      }
      setValue(newValue);
      onChange(field.path, newValue);
    },
    [fieldApi, field.path, onChange],
  );

  return (
    <Field orientation="vertical">
      <FieldLabel htmlFor={id}>{(field.metadata?.title as string) ?? field.path}</FieldLabel>
      <FieldContent>
        {renderControl(field, id, value, handleChange)}
        {field.metadata?.description ? (
          <FieldDescription>{field.metadata.description as string}</FieldDescription>
        ) : null}
      </FieldContent>
    </Field>
  );
}

function renderControl(field: SchemaFieldInfo, id: string, value: unknown, onChange: (value: unknown) => void) {
  if (field.type === "enum" && field.metadata?.enum) {
    const options = field.metadata.enum as readonly unknown[];
    return (
      <NativeSelect id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
        <NativeSelectOption value="">— Select —</NativeSelectOption>
        {options.map((opt) => (
          <NativeSelectOption key={String(opt)} value={String(opt)}>
            {String(opt)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }

  if (field.type === "boolean") {
    return <Switch id={id} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />;
  }

  if (field.type === "number" || field.type === "integer") {
    return (
      <Input
        id={id}
        type="number"
        step={field.type === "integer" ? 1 : "any"}
        value={value != null ? String(value) : ""}
        onChange={(e) => {
          const num = field.type === "integer" ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
          onChange(Number.isNaN(num) ? "" : num);
        }}
      />
    );
  }

  return <Input id={id} type="text" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
}
