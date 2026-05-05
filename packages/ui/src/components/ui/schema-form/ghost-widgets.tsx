"use client";

import type { FormApi, ValidationIssue } from "@formbar/core";
import type { SchemaFieldInfo } from "@formbar/from-schema";
import type { ComponentType, ReactNode } from "react";
import { Input } from "../input";
import { Label } from "../label";
import { RadioGroup, RadioGroupItem } from "../radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { Slider } from "../slider";
import { Switch } from "../switch";
import { Textarea } from "../textarea";
import type { FieldMapping } from "./field-mapping";

export interface WidgetProps {
  readonly field: ReturnType<FormApi<unknown, unknown>["field"]>;
  readonly fieldInfo: SchemaFieldInfo;
  readonly mapping: FieldMapping;
  readonly aria: FieldAriaAttributes;
  readonly readOnly?: boolean;
  readonly disabled?: boolean;
}

/** Aria attributes passed to widget components */
export interface FieldAriaAttributes {
  readonly id: string;
  readonly "aria-invalid"?: boolean;
  readonly "aria-describedby"?: string;
  readonly "aria-required"?: boolean;
}

/** Typed widget props — field accessors are typed to TValue */
export interface TypedWidgetProps<TValue> {
  readonly field: {
    get(): TValue;
    handleChange(value: TValue): void;
    handleBlur(): void;
    isTouched(): boolean;
    isDirty(): boolean;
    issues(): readonly ValidationIssue[];
    readonly path: string;
  };
  readonly fieldInfo: SchemaFieldInfo;
  readonly mapping: FieldMapping;
  readonly aria: FieldAriaAttributes;
}

/**
 * Type-safe widget factory — wraps a typed component as a WidgetProps component.
 * The cast is safe because the runtime field API is identical — generics only narrow at compile time.
 */
export function createWidget<TValue>(Component: ComponentType<TypedWidgetProps<TValue>>): ComponentType<WidgetProps> {
  return Component as unknown as ComponentType<WidgetProps>;
}

export function GhostInputWidget({ field, mapping, aria }: WidgetProps): ReactNode {
  const value = field.get();
  const { htmlAttrs } = mapping;

  return (
    <Input
      {...aria}
      type={mapping.inputType ?? "text"}
      step={mapping.inputStep}
      value={value == null ? "" : String(value)}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const parsed = mapping.inputType === "number" ? (raw === "" ? "" : Number(raw)) : raw;
        field.handleChange(parsed as never);
      }}
      onBlur={() => field.handleBlur()}
      {...htmlAttrs}
    />
  );
}

export function GhostTextareaWidget({ field, mapping, aria }: WidgetProps): ReactNode {
  const value = field.get();
  const { htmlAttrs } = mapping;

  return (
    <Textarea
      {...aria}
      value={value == null ? "" : String(value)}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => field.handleChange(e.target.value as never)}
      onBlur={() => field.handleBlur()}
      {...htmlAttrs}
    />
  );
}

export function GhostSwitchWidget({ field, aria }: WidgetProps): ReactNode {
  const value = field.get();

  return <Switch {...aria} checked={!!value} onCheckedChange={(val: boolean) => field.handleChange(val as never)} />;
}

export function GhostSliderWidget({ field, mapping, aria }: WidgetProps): ReactNode {
  const value = field.get();
  const { htmlAttrs } = mapping;

  return (
    <Slider
      {...aria}
      value={[typeof value === "number" ? value : 0]}
      onValueChange={([v]: number[]) => field.handleChange(v as never)}
      min={typeof htmlAttrs.min === "number" ? htmlAttrs.min : 0}
      max={typeof htmlAttrs.max === "number" ? htmlAttrs.max : 100}
      step={mapping.inputStep === "1" ? 1 : 0.01}
    />
  );
}

export function GhostSelectWidget({ field, fieldInfo, aria }: WidgetProps): ReactNode {
  const values = (fieldInfo.metadata?.enum ?? fieldInfo.metadata?.options ?? []) as readonly unknown[];

  return (
    <Select
      value={field.get() == null ? "" : String(field.get())}
      onValueChange={(v: string) => field.handleChange(v as never)}
    >
      <SelectTrigger {...aria}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((v) => (
          <SelectItem key={String(v)} value={String(v)}>
            {String(v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function GhostRadioGroupWidget({ field, fieldInfo, aria }: WidgetProps): ReactNode {
  const values = (fieldInfo.metadata?.enum ?? fieldInfo.metadata?.options ?? []) as readonly unknown[];

  return (
    <RadioGroup
      {...aria}
      value={field.get() == null ? "" : String(field.get())}
      onValueChange={(v: string) => field.handleChange(v as never)}
    >
      {values.map((v) => (
        <div key={String(v)} className="flex items-center gap-2">
          <RadioGroupItem value={String(v)} id={`${aria.id}-${String(v)}`} />
          <Label htmlFor={`${aria.id}-${String(v)}`}>{String(v)}</Label>
        </div>
      ))}
    </RadioGroup>
  );
}

export const GHOST_DEFAULT_WIDGETS: Readonly<Record<string, ComponentType<WidgetProps>>> = {
  input: GhostInputWidget,
  textarea: GhostTextareaWidget,
  switch: GhostSwitchWidget,
  slider: GhostSliderWidget,
  select: GhostSelectWidget,
  "radio-group": GhostRadioGroupWidget,
};
