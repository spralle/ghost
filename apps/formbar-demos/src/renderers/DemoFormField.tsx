import type { FormApi } from "@formbar/core";
import type { SchemaFieldInfo } from "@formbar/from-schema";
import {
  Badge,
  cn,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
  Textarea,
} from "@ghost-shell/ui";
import { useCallback, useEffect, useRef, useState } from "react";

interface FieldMeta {
  readonly widget: string | undefined;
  readonly enumValues: readonly string[] | undefined;
  readonly format: string | undefined;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly minLength: number | undefined;
  readonly maxLength: number | undefined;
  readonly pattern: string | undefined;
  readonly title: string;
  readonly description: string | undefined;
}

function extractFieldMeta(field: SchemaFieldInfo): FieldMeta {
  const meta = field.metadata;
  return {
    widget: meta?.widget,
    enumValues: Array.isArray(meta?.enum) ? meta.enum.map(String) : undefined,
    format: meta?.format,
    min: meta?.minimum,
    max: meta?.maximum,
    minLength: meta?.minLength,
    maxLength: meta?.maxLength,
    pattern: meta?.pattern,
    title: meta?.title ?? field.path,
    description: meta?.description,
  };
}

interface DemoFormFieldProps {
  readonly form: FormApi;
  readonly field: SchemaFieldInfo;
  readonly onChange: (path: string, value: unknown) => void;
}

function buildConstraints(
  field: SchemaFieldInfo,
  min: number | undefined,
  max: number | undefined,
  minLength: number | undefined,
  maxLength: number | undefined,
  pattern: string | undefined,
  format: string | undefined,
): string[] {
  const constraints: string[] = [];
  if (field.required) constraints.push("Required");
  if (minLength) constraints.push(`Min ${minLength} chars`);
  if (maxLength) constraints.push(`Max ${maxLength} chars`);
  if (pattern) constraints.push(`Pattern: ${pattern}`);
  if (min != null && max != null && field.type !== "number" && field.type !== "integer")
    constraints.push(`${min}–${max}`);
  if (format) constraints.push(format);
  return constraints;
}

export function DemoFormField({ form, field, onChange }: DemoFormFieldProps) {
  const fieldApiRef = useRef(form.field(field.path));
  const fieldApi = fieldApiRef.current;
  const [value, setValue] = useState<unknown>(() => fieldApi.get());

  useEffect(() => {
    return form.subscribe(() => {
      const storeValue = fieldApi.get();
      setValue((prev: unknown) => (Object.is(prev, storeValue) ? prev : storeValue));
    });
  }, [form, fieldApi]);

  const handleChange = useCallback(
    (newValue: unknown) => {
      fieldApi.set(newValue);
      onChange(field.path, newValue);
    },
    [fieldApi, field.path, onChange],
  );

  const { widget, enumValues, format, min, max, minLength, maxLength, pattern, title, description } =
    extractFieldMeta(field);

  const issues = form.getState().issues?.filter((i) => i.path.segments.join(".") === field.path) ?? [];
  const hasError = issues.length > 0;

  const constraints = buildConstraints(field, min, max, minLength, maxLength, pattern, format);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium text-foreground">{title}</Label>
        {field.required && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            Required
          </Badge>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div>
        {renderControl(
          field,
          value,
          handleChange,
          widget,
          enumValues,
          format,
          min,
          max,
          minLength,
          maxLength,
          pattern,
          hasError,
        )}
      </div>
      {hasError && <p className="text-xs text-destructive">{issues[0]?.message}</p>}
      {!hasError && constraints.length > 0 && (
        <p className="text-xs text-muted-foreground">{constraints.join(" · ")}</p>
      )}
    </div>
  );
}

function renderEnumControl(
  field: SchemaFieldInfo,
  value: unknown,
  onChange: (v: unknown) => void,
  enumValues: readonly string[],
  hasError: boolean,
): React.ReactNode {
  if (enumValues.length <= 5) {
    return (
      <RadioGroup value={(value as string) ?? ""} onValueChange={onChange} className="flex flex-col gap-2">
        {enumValues.map((opt) => (
          <div key={opt} className="flex items-center gap-2">
            <RadioGroupItem value={opt} id={`${field.path}-${opt}`} />
            <Label htmlFor={`${field.path}-${opt}`} className="text-sm text-foreground">
              {opt}
            </Label>
          </div>
        ))}
      </RadioGroup>
    );
  }
  const errorClass = hasError ? "border-destructive" : "";
  return (
    <Select value={(value as string) ?? ""} onValueChange={onChange}>
      <SelectTrigger className={cn(errorClass)}>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {enumValues.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function renderStringControl(
  value: unknown,
  onChange: (v: unknown) => void,
  widget: string | undefined,
  format: string | undefined,
  minLength: number | undefined,
  maxLength: number | undefined,
  pattern: string | undefined,
  hasError: boolean,
): React.ReactNode {
  const errorClass = hasError ? "border-destructive" : "";
  if (widget === "textarea" || (maxLength != null && maxLength > 200)) {
    return (
      <Textarea
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn(errorClass)}
        maxLength={maxLength}
        rows={4}
      />
    );
  }
  const inputType = format === "email" ? "email" : format === "uri" ? "url" : "text";
  return (
    <Input
      type={inputType}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={cn(errorClass)}
      minLength={minLength}
      maxLength={maxLength}
      pattern={pattern}
    />
  );
}

function renderNumberControl(
  field: SchemaFieldInfo,
  value: unknown,
  onChange: (v: unknown) => void,
  min: number | undefined,
  max: number | undefined,
  hasError: boolean,
): React.ReactNode {
  if (min != null && max != null) {
    return (
      <div className="flex items-center gap-3">
        <Slider
          min={min}
          max={max}
          step={field.type === "integer" ? 1 : 0.1}
          value={[typeof value === "number" ? value : min]}
          onValueChange={([v]) => onChange(v)}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground w-10 text-right">{typeof value === "number" ? value : min}</span>
      </div>
    );
  }
  const errorClass = hasError ? "border-destructive" : "";
  const step = field.type === "integer" ? 1 : "any";
  const parseValue = (raw: string) => {
    if (raw === "") return undefined;
    return field.type === "integer" ? parseInt(raw, 10) : parseFloat(raw);
  };
  return (
    <Input
      type="number"
      step={step}
      min={min}
      max={max}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(parseValue(e.target.value))}
      className={cn(errorClass)}
    />
  );
}

function renderBooleanControl(value: unknown, onChange: (v: unknown) => void): React.ReactNode {
  return <Switch checked={Boolean(value)} onCheckedChange={onChange} />;
}

function renderControl(
  field: SchemaFieldInfo,
  value: unknown,
  onChange: (v: unknown) => void,
  widget: string | undefined,
  enumValues: readonly string[] | undefined,
  format: string | undefined,
  min: number | undefined,
  max: number | undefined,
  minLength: number | undefined,
  maxLength: number | undefined,
  pattern: string | undefined,
  hasError: boolean,
): React.ReactNode {
  if (field.type === "enum" && enumValues) {
    return renderEnumControl(field, value, onChange, enumValues, hasError);
  }
  if (field.type === "boolean") {
    return renderBooleanControl(value, onChange);
  }
  if (field.type === "string") {
    return renderStringControl(value, onChange, widget, format, minLength, maxLength, pattern, hasError);
  }
  if (field.type === "number" || field.type === "integer") {
    return renderNumberControl(field, value, onChange, min, max, hasError);
  }
  const errorClass = hasError ? "border-destructive" : "";
  return (
    <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={cn(errorClass)} />
  );
}
